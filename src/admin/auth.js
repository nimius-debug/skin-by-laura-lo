// Single-owner login for /admin. The username and password live in Worker
// secrets (ADMIN_USERNAME, ADMIN_PASSWORD), never in the repo. A successful
// login sets a signed, HttpOnly session cookie. The signing key is the
// password itself, so changing the password signs every device out.
//
// Two kinds of session:
//   - "Keep me signed in" (the default on the login form): 90 days, renewed
//     whenever the admin is used, so a phone that opens it now and then stays
//     signed in. Meant for Laura's own phone, which is protected by its passcode
//     and Face ID.
//   - Otherwise: 12 hours, not renewed.

const SESSION_COOKIE = "admin_session";
const SHORT_SESSION_SECONDS = 12 * 3600;
const REMEMBER_DAYS = 90;
const REMEMBER_SECONDS = REMEMBER_DAYS * 24 * 3600;
// A remembered session is re-issued once it is more than a day old, keeping it 90 days from last use.
const RENEW_AFTER_SECONDS = 24 * 3600;
const encoder = new TextEncoder();

export function adminAuthConfigured(env) {
  return Boolean(env.ADMIN_USERNAME && env.ADMIN_PASSWORD);
}

async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
  return [...signature].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function credentialsMatch(env, username, password) {
  if (!adminAuthConfigured(env)) return false;
  // Hash both sides so the comparison takes the same time whatever was typed.
  const userOk = bytesEqual(await sha256(username), await sha256(env.ADMIN_USERNAME));
  const passOk = bytesEqual(await sha256(password), await sha256(env.ADMIN_PASSWORD));
  return userOk && passOk;
}

/** Token format: `<expires unix seconds>.<r|s>.<hmac>`, where r = remembered, s = short. */
export async function createSessionToken(env, now = Date.now(), { remember = false } = {}) {
  const kind = remember ? "r" : "s";
  const expires = Math.floor(now / 1000) + (remember ? REMEMBER_SECONDS : SHORT_SESSION_SECONDS);
  const signature = await hmacHex(env.ADMIN_PASSWORD, `${env.ADMIN_USERNAME}:${expires}:${kind}`);
  return `${expires}.${kind}.${signature}`;
}

/** The session a token carries, or null if it is missing, tampered with, or expired. */
export async function readSession(env, token, now = Date.now()) {
  if (!adminAuthConfigured(env) || typeof token !== "string") return null;
  const [expiresText, kind, signature] = token.split(".");
  const expires = Number(expiresText);
  if (!Number.isInteger(expires) || (kind !== "r" && kind !== "s") || !signature) return null;
  if (expires * 1000 <= now) return null;
  const expected = await hmacHex(env.ADMIN_PASSWORD, `${env.ADMIN_USERNAME}:${expires}:${kind}`);
  if (!bytesEqual(encoder.encode(signature), encoder.encode(expected))) return null;
  return { expires, remember: kind === "r" };
}

export async function isValidSession(env, token, now = Date.now()) {
  return Boolean(await readSession(env, token, now));
}

/** True when a remembered session should be re-issued to push its expiry 90 days past now. */
export function shouldRenew(session, now = Date.now()) {
  if (!session?.remember) return false;
  return session.expires - Math.floor(now / 1000) < REMEMBER_SECONDS - RENEW_AFTER_SECONDS;
}

export function readSessionCookie(request) {
  const header = request.headers.get("cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

export function sessionCookie(token, { remember = false } = {}) {
  const maxAge = remember ? REMEMBER_SECONDS : SHORT_SESSION_SECONDS;
  return `${SESSION_COOKIE}=${token}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearedSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
