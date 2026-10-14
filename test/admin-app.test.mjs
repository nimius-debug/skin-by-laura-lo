import { handleAdminRequest } from "../src/admin/routes.js";
import { adminPage, loginPage } from "../src/admin/layout.js";
import { MANIFEST } from "../src/admin/pwa.js";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

const env = { ADMIN_USERNAME: "laura", ADMIN_PASSWORD: "pw-for-tests" };
// No login cookie on any of these: the phone fetches the manifest and icons before anyone is signed in.
const get = (path) => handleAdminRequest(new Request(`https://x.test${path}`), env, new URL(`https://x.test${path}`));

const manifestRes = await get("/admin/manifest.webmanifest");
check("the manifest is public and served as a web manifest", [manifestRes.status, manifestRes.headers.get("content-type")], [200, "application/manifest+json; charset=utf-8"]);
const manifest = await manifestRes.json();
check("it opens the admin as a standalone app", [manifest.display, manifest.start_url], ["standalone", "/admin"]);
check("the start page is inside the app's scope", manifest.start_url.startsWith(manifest.scope), true);
check("it names the app and sets brand colours", [manifest.short_name, manifest.theme_color, manifest.background_color], ["Laura Admin", "#2A241F", "#FBF6F0"]);
check("the manifest holds nothing but app details", Object.keys(MANIFEST).sort(),
  ["background_color", "display", "icons", "id", "name", "scope", "short_name", "start_url", "theme_color"]);

for (const icon of manifest.icons) {
  const res = await get(icon.src);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const [w, h] = icon.sizes.split("x").map(Number);
  check(`${icon.src} is a public PNG of the size the manifest declares`,
    [res.status, res.headers.get("content-type"), bytes[1] === 0x50, view.getUint32(16), view.getUint32(20)], [200, "image/png", true, w, h]);
}

const touch = await get("/admin/assets/apple-touch-icon.png");
const touchBytes = new Uint8Array(await touch.arrayBuffer());
check("the iPhone home screen icon is a 180 px PNG", [touch.status, new DataView(touchBytes.buffer).getUint32(16)], [200, 180]);
check("an unknown icon is not found", (await get("/admin/assets/nope.png")).status, 404);
check("an icon name can't reach object internals", (await get("/admin/assets/constructor.png")).status, 404);
check("a name outside the icon pattern is never served publicly", (await get("/admin/assets/__proto__.png")).status, 303);

const clientsRes = await get("/admin");
check("the admin itself still needs a login", [clientsRes.status, clientsRes.headers.get("location")], [303, "/admin/login"]);

for (const [name, markup] of [["admin pages", adminPage({ title: "Clients", body: "<p>x</p>" })], ["the login page", loginPage({})]]) {
  check(`${name} link the manifest and the iPhone icon`,
    markup.includes('rel="manifest" href="/admin/manifest.webmanifest"') && markup.includes('rel="apple-touch-icon" href="/admin/assets/apple-touch-icon.png"'), true);
  check(`${name} ask iOS to open as a full-screen app with a dark status bar`,
    markup.includes('name="apple-mobile-web-app-capable" content="yes"') && markup.includes('name="apple-mobile-web-app-status-bar-style" content="black"') && markup.includes('name="theme-color" content="#2A241F"'), true);
}
check("on a phone, fields are 16px so iOS doesn't zoom in when one is tapped",
  /@media \(max-width: 760px\)\s*\{[^}]*input, textarea \{ font-size: 16px; \}/.test(adminPage({ title: "x", body: "" })), true);

console.log(failures === 0 ? "\nAll admin-app tests passed." : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
