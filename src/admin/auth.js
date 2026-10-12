// Single-owner login for /admin. The username and password live in Worker
// secrets (ADMIN_USERNAME, ADMIN_PASSWORD), never in the repo. A successful
// login sets a signed, HttpOnly session cookie. The signing key is the
// password itself, so changing the password signs everyone out.

const SESSION_COOKIE = "admin_session";
const SESSION_HOURS = 12;
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

export async function createSessionToken(env, now = Date.now()) {
  const expires = Math.floor(now / 1000) + SESSION_HOURS * 3600;
  const signature = await hmacHex(env.ADMIN_PASSWORD, `${env.ADMIN_USERNAME}:${expires}`);
  return `${expires}.${signature}`;
}

export async function isValidSession(env, token, now = Date.now()) {
  if (!adminAuthConfigured(env) || typeof token !== "string") return false;
  const [expiresText, signature] = token.split(".");
  const expires = Number(expiresText);
  if (!Number.isInteger(expires) || !signature) return false;
  if (expires * 1000 <= now) return false;
  const expected = await hmacHex(env.ADMIN_PASSWORD, `${env.ADMIN_USERNAME}:${expires}`);
  return bytesEqual(encoder.encode(signature), encoder.encode(expected));
}

export function readSessionCookie(request) {
  const header = request.headers.get("cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

export function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`;
}

export function clearedSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
