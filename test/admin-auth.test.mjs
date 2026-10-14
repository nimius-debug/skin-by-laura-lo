import {
  adminAuthConfigured, clearedSessionCookie, createSessionToken, credentialsMatch,
  isValidSession, readSessionCookie, sessionCookie,
} from "../src/admin/auth.js";
import { handleAdminRequest } from "../src/admin/routes.js";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

const env = { ADMIN_USERNAME: "laura", ADMIN_PASSWORD: "correct horse battery" };
const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);

check("unset secrets mean login is not configured", adminAuthConfigured({}), false);
check("username and password together mean configured", adminAuthConfigured(env), true);
check("a missing password alone is not configured", adminAuthConfigured({ ADMIN_USERNAME: "laura" }), false);

check("right username and password match", await credentialsMatch(env, "laura", "correct horse battery"), true);
check("wrong password does not match", await credentialsMatch(env, "laura", "wrong"), false);
check("wrong username does not match", await credentialsMatch(env, "someone", "correct horse battery"), false);
check("an empty password does not match", await credentialsMatch(env, "laura", ""), false);
check("nothing matches when login is not configured", await credentialsMatch({}, "", ""), false);

const token = await createSessionToken(env, NOW);
check("a fresh session token is valid", await isValidSession(env, token, NOW + 60_000), true);
check("a session expires after 12 hours", await isValidSession(env, token, NOW + 13 * 3600 * 1000), false);
check("a missing cookie is not a session", await isValidSession(env, null, NOW), false);
check("a made-up cookie is not a session", await isValidSession(env, "9999999999.abc", NOW), false);

const [expires, kind, signature] = token.split(".");
const tampered = `${expires}.${kind}.${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}`;
check("a tampered signature is rejected", await isValidSession(env, tampered, NOW), false);
const pushedExpiry = `${Number(expires) + 3600}.${kind}.${signature}`;
check("a changed expiry is rejected", await isValidSession(env, pushedExpiry, NOW), false);
check("a short session can't be turned into a remembered one", await isValidSession(env, `${expires}.r.${signature}`, NOW), false);
check("an old two-part token is not a session", await isValidSession(env, `${expires}.${signature}`, NOW), false);

const rotated = { ...env, ADMIN_PASSWORD: "a new password" };
check("changing the password signs old sessions out", await isValidSession(rotated, token, NOW), false);

const cookieReq = new Request("https://x.test/admin", { headers: { cookie: `theme=dark; admin_session=${token}; other=1` } });
check("the session cookie is found among others", readSessionCookie(cookieReq), token);
check("no cookie header gives no session", readSessionCookie(new Request("https://x.test/admin")), null);

const flags = sessionCookie(token);
check("session cookie is HttpOnly, Secure, SameSite=Strict, scoped to /admin",
  ["HttpOnly", "Secure", "SameSite=Strict", "Path=/admin"].every((flag) => flags.includes(flag)), true);
check("logging out clears the cookie", clearedSessionCookie().includes("Max-Age=0"), true);

const anon = await handleAdminRequest(new Request("https://x.test/admin"), env, new URL("https://x.test/admin"));
check("signed-out visitors are sent to the login page", [anon.status, anon.headers.get("location")], [303, "/admin/login"]);

const syncAnon = await handleAdminRequest(
  new Request("https://x.test/admin/sync", { method: "POST" }), env, new URL("https://x.test/admin/sync"),
);
check("signed-out API calls get 401, not data", syncAnon.status, 401);

const loginPageRes = await handleAdminRequest(new Request("https://x.test/admin/login"), env, new URL("https://x.test/admin/login"));
const loginHtml = await loginPageRes.text();
check("the login page renders a username and password form",
  loginHtml.includes('name="username"') && loginHtml.includes('type="password"'), true);

const badLogin = new Request("https://x.test/admin/login", {
  method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "username=laura&password=nope",
});
const badRes = await handleAdminRequest(badLogin, env, new URL("https://x.test/admin/login"));
check("a wrong password gets the login page back with 401", badRes.status, 401);
check("a wrong password sets no session cookie", badRes.headers.get("set-cookie"), null);

const goodLogin = new Request("https://x.test/admin/login", {
  method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
  body: "username=laura&password=correct+horse+battery",
});
const goodRes = await handleAdminRequest(goodLogin, env, new URL("https://x.test/admin/login"));
check("a correct login redirects to /admin", [goodRes.status, goodRes.headers.get("location")], [303, "/admin"]);
check("a correct login sets a session cookie", goodRes.headers.get("set-cookie")?.startsWith("admin_session="), true);

const uploadReq = new Request("https://x.test/admin/clients/c1/notes/new", { headers: { cookie: `admin_session=${await createSessionToken(env)}` } });
const uploadRes = await handleAdminRequest(uploadReq, env, new URL("https://x.test/admin/clients/c1/notes/new"));
check("the PDF upload page is switched off", uploadRes.status, 404);

console.log(failures === 0 ? "\nAll admin-auth tests passed." : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
