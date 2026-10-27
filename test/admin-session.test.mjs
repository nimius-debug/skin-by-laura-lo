import { createSessionToken, readSession, shouldRenew, sessionCookie } from "../src/admin/auth.js";
import { handleAdminRequest } from "../src/admin/routes.js";
import { ASSET_VERSION } from "../src/admin/pwa.js";
import { createD1, schemaMigrations } from "./helpers/d1-sqlite.mjs";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

const DAY = 24 * 3600 * 1000;
const db = createD1({ migrations: schemaMigrations() });
db.raw.prepare("INSERT INTO clients (id, name, square_customer_id) VALUES ('c1', 'Ana Casado', 'SQ-TEST')").run();
const env = { ADMIN_USERNAME: "laura", ADMIN_PASSWORD: "pw-for-tests", CLIENT_NOTES_DB: db };

const request = (path, { method = "GET", cookie, body, ip } = {}) => {
  const headers = {};
  if (cookie) headers.cookie = `admin_session=${cookie}`;
  if (body) headers["content-type"] = "application/x-www-form-urlencoded";
  if (ip) headers["cf-connecting-ip"] = ip;
  return handleAdminRequest(new Request(`https://x.test${path}`, { method, headers, body }), env, new URL(`https://x.test${path}`));
};
const maxAge = (response) => Number((response.headers.get("set-cookie") || "").match(/Max-Age=(\d+)/)?.[1] || 0);

// --- remembered sessions ----------------------------------------------------

const now = Date.now();
const remembered = await createSessionToken(env, now, { remember: true });
const session = await readSession(env, remembered, now);
check("'keep me signed in' lasts 90 days", [session.remember, Math.round((session.expires * 1000 - now) / DAY)], [true, 90]);
check("it is still valid after 60 days without renewal", Boolean(await readSession(env, remembered, now + 60 * DAY)), true);
check("it ends after 90 days without use", await readSession(env, remembered, now + 91 * DAY), null);
check("a fresh remembered session isn't renewed yet", shouldRenew(session, now), false);
check("a remembered session over a day old is renewed", shouldRenew(session, now + 2 * DAY), true);
check("a short session is never renewed", shouldRenew(await readSession(env, await createSessionToken(env, now), now), now + 2 * 3600 * 1000), false);
check("a remembered cookie is kept by the phone for 90 days", sessionCookie(remembered, { remember: true }).includes("Max-Age=7776000"), true);

const login = (body, ip = "10.0.0.1") => request("/admin/login", { method: "POST", body, ip });
const rememberLogin = await login("username=laura&password=pw-for-tests&remember=on");
check("logging in with 'keep me signed in' sets a 90-day cookie", [rememberLogin.status, maxAge(rememberLogin)], [303, 7776000]);
const shortLogin = await login("username=laura&password=pw-for-tests");
check("logging in without it sets a 12-hour cookie", [shortLogin.status, maxAge(shortLogin)], [303, 43200]);
check("the login page ticks 'keep me signed in' by default",
  (await (await request("/admin/login")).text()).includes('name="remember" value="on" checked'), true);

// Renewal: a remembered cookie from three days ago gets a fresh 90 days when the admin is used.
const oldRemembered = await createSessionToken(env, now - 3 * DAY, { remember: true });
const used = await request("/admin", { cookie: oldRemembered });
check("using the admin renews a remembered session", [used.status, maxAge(used)], [200, 7776000]);
const renewedToken = used.headers.get("set-cookie").match(/admin_session=([^;]+)/)[1];
check("the renewed session runs 90 days from now", Math.round(((await readSession(env, renewedToken)).expires * 1000 - Date.now()) / DAY), 90);
check("a fresh remembered session isn't re-sent on every page", (await request("/admin", { cookie: remembered })).headers.get("set-cookie"), null);
check("a short session isn't extended by use", (await request("/admin", { cookie: await createSessionToken(env, now - 3600 * 1000) })).headers.get("set-cookie"), null);

// --- lockout ----------------------------------------------------------------

const wrong = "username=laura&password=nope";
const statuses = [];
for (let i = 0; i < 5; i += 1) statuses.push((await login(wrong, "10.9.9.9")).status);
check("four wrong passwords are just wrong; the fifth locks the address out", statuses, [401, 401, 401, 401, 429]);
const lockedOut = await login("username=laura&password=pw-for-tests", "10.9.9.9");
check("while locked out, even the right password is refused", [lockedOut.status, (await lockedOut.text()).includes("Too many wrong tries. Try again in 15 minutes.")], [429, true]);
check("another address can still log in", (await login("username=laura&password=pw-for-tests", "10.1.1.1")).status, 303);

for (let i = 0; i < 3; i += 1) await login(wrong, "10.2.2.2");
await login("username=laura&password=pw-for-tests", "10.2.2.2");
check("a successful login clears the wrong-password count",
  db.raw.prepare("SELECT COUNT(*) AS n FROM admin_login_attempts WHERE client_key = '10.2.2.2'").get().n, 0);

const noDbEnv = { ADMIN_USERNAME: "laura", ADMIN_PASSWORD: "pw-for-tests" };
const noDbLogin = await handleAdminRequest(new Request("https://x.test/admin/login", {
  method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "username=laura&password=pw-for-tests",
}), noDbEnv, new URL("https://x.test/admin/login"));
check("without the database, logging in still works", noDbLogin.status, 303);

// --- the app shell ----------------------------------------------------------

const sw = await request("/admin/sw.js");
const swText = await sw.text();
check("the service worker is public and may look after all of /admin",
  [sw.status, sw.headers.get("service-worker-allowed"), sw.headers.get("content-type")], [200, "/admin", "text/javascript; charset=utf-8"]);
// Run the service worker itself against fake requests and see what it stores.
const listeners = {};
const stored = [];
let online = true;
const fakeCache = { addAll: async () => {}, match: async () => null, put: async (req) => { stored.push(new URL(req.url).pathname); } };
const swGlobals = {
  self: { addEventListener: (type, fn) => { listeners[type] = fn; }, location: { origin: "https://x.test" }, skipWaiting: async () => {}, clients: { claim: async () => {} } },
  caches: { open: async () => fakeCache, keys: async () => [], delete: async () => true, match: async (path) => new Response(`cached ${path}`) },
  fetch: async () => { if (!online) throw new TypeError("offline"); return new Response("from network", { status: 200 }); },
  URL, Response, Promise,
};
new Function(...Object.keys(swGlobals), swText)(...Object.values(swGlobals));
const swFetch = async (url, mode) => {
  let answer = null;
  listeners.fetch({ request: { method: "GET", url, mode }, respondWith: (promise) => { answer = promise; } });
  return answer ? (await answer).text() : "not handled";
};
check("a client page comes from the network", await swFetch("https://x.test/admin/clients/c1", "navigate"), "from network");
check("the app's own script is kept for fast launches", [await swFetch(`https://x.test/admin/assets/admin.js?v=${ASSET_VERSION}`, "no-cors"), stored], ["from network", ["/admin/assets/admin.js"]]);
check("client pages are never stored on the phone", stored.some((path) => path.startsWith("/admin/clients")), false);
online = false;
check("with no connection a page shows the offline screen", await swFetch("https://x.test/admin/clients/c1", "navigate"), "cached /admin/offline");
check("requests to other sites are left alone", await swFetch("https://fonts.googleapis.com/css2", "no-cors"), "not handled");
const offline = await request("/admin/offline");
check("the offline screen is public and says so plainly", [offline.status, (await offline.text()).includes("You're offline")], [200, true]);

const script = await request(`/admin/assets/admin.js?v=${ASSET_VERSION}`);
check("the app script is cached for a year, since its address changes with every change", script.headers.get("cache-control"), "public, max-age=31536000, immutable");
const home = await (await request("/admin", { cookie: remembered })).text();
check("pages load the script at its current version", home.includes(`/admin/assets/admin.js?v=${ASSET_VERSION}`), true);
check("the clients list has no back button", home.includes('class="nav-back"'), false);
const clientPage = await (await request("/admin/clients/c1", { cookie: remembered })).text();
check("a client page has a back button to Clients", clientPage.includes('class="admin-nav has-back"') && clientPage.includes('href="/admin"><span class="nav-back-chevron"'), true);
check("pages run edge to edge under the status bar and Dynamic Island",
  clientPage.includes("viewport-fit=cover") && clientPage.includes('content="black-translucent"') && clientPage.includes("env(safe-area-inset-top)"), true);
check("the iPhone 17 Pro and Pro Max get launch screens",
  clientPage.includes("device-width: 402px) and (device-height: 874px)") && clientPage.includes("device-width: 440px) and (device-height: 956px)"), true);
const launch = await request("/admin/assets/launch-1206x2622.png");
const launchBytes = new Uint8Array(await launch.arrayBuffer());
const view = new DataView(launchBytes.buffer);
check("the iPhone 17 Pro launch screen is 1206 x 2622 px", [launch.status, view.getUint32(16), view.getUint32(20)], [200, 1206, 2622]);

console.log(failures === 0 ? "\nAll admin-session tests passed." : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
