// A short lockout after repeated wrong passwords, so the single admin password
// can't be guessed by trying many times. Keyed by the visitor's network address.
// Everything here fails soft: if the database can't be reached, logins still
// work as before rather than locking Laura out.

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

export function loginKey(request) {
  return request.headers.get("cf-connecting-ip") || "unknown";
}

function minutesLeft(lockedUntil, now) {
  return lockedUntil > now ? Math.ceil((lockedUntil - now) / 60000) : 0;
}

/** Minutes until this address may try again, or 0 if it isn't locked out. */
export async function lockedFor(env, key, now = Date.now()) {
  if (!env.CLIENT_NOTES_DB) return 0;
  try {
    const row = await env.CLIENT_NOTES_DB.prepare(
      "SELECT locked_until FROM admin_login_attempts WHERE client_key = ?",
    ).bind(key).first();
    return row ? minutesLeft(row.locked_until, now) : 0;
  } catch (error) {
    console.error("Reading login attempts failed:", error.message);
    return 0;
  }
}

/**
 * Count a wrong password. Failures more than 15 minutes apart start a new count;
 * the fifth within 15 minutes locks the address out for 15 minutes.
 * Returns the minutes locked out (0 if not locked).
 */
export async function recordFailure(env, key, now = Date.now()) {
  if (!env.CLIENT_NOTES_DB) return 0;
  try {
    await env.CLIENT_NOTES_DB.prepare(
      `INSERT INTO admin_login_attempts (client_key, failures, first_failed_at, locked_until) VALUES (?1, 1, ?2, 0)
       ON CONFLICT (client_key) DO UPDATE SET
         failures = CASE WHEN ?2 - first_failed_at > ?3 THEN 1 ELSE failures + 1 END,
         locked_until = CASE WHEN (CASE WHEN ?2 - first_failed_at > ?3 THEN 1 ELSE failures + 1 END) >= ?4 THEN ?2 + ?5 ELSE locked_until END,
         first_failed_at = CASE WHEN ?2 - first_failed_at > ?3 THEN ?2 ELSE first_failed_at END`,
    ).bind(key, now, WINDOW_MS, MAX_FAILURES, LOCK_MS).run();
    return await lockedFor(env, key, now);
  } catch (error) {
    console.error("Recording a failed login failed:", error.message);
    return 0;
  }
}

export async function clearFailures(env, key) {
  if (!env.CLIENT_NOTES_DB) return;
  try {
    await env.CLIENT_NOTES_DB.prepare("DELETE FROM admin_login_attempts WHERE client_key = ?").bind(key).run();
  } catch (error) {
    console.error("Clearing login attempts failed:", error.message);
  }
}
