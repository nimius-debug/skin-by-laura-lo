// Makes the admin feel like an iPhone app when added to the Home Screen
// (Safari: Share, Add to Home Screen): manifest, icons, launch screens, an
// offline screen and a small service worker.
//
// The manifest, icons, offline page and service worker are public on purpose:
// the phone fetches them without the login cookie, and they contain nothing
// but the app's name, colours, icon and code. Client pages are never cached on
// the phone; the service worker only keeps the app's own files. The one thing
// kept on the device is a note being written on the iPad, until it is saved
// to the dashboard (see notebook-client.js).

import { ADMIN_CLIENT_JS } from "./client.js";

export const MANIFEST = {
  name: "Laura — Admin",
  short_name: "Laura Admin",
  id: "/admin",
  start_url: "/admin",
  scope: "/admin",
  display: "standalone",
  background_color: "#2A241F",
  theme_color: "#2A241F",
  icons: [
    { src: "/admin/assets/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/admin/assets/icon-512.png", sizes: "512x512", type: "image/png" },
  ],
};

/** A short, stable fingerprint of some text. Used to version cached files, so a deploy replaces them. */
export function contentVersion(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

/** The admin script's version: changes whenever the script does, so it can be cached for a year. */
export const ASSET_VERSION = contentVersion(ADMIN_CLIENT_JS);

// Launch screens shown while the app opens. iOS picks the one matching the device's screen.
const LAUNCH_SCREENS = [
  { width: 402, height: 874, file: "launch-1206x2622.png" }, // iPhone 17 Pro
  { width: 440, height: 956, file: "launch-1320x2868.png" }, // iPhone 17 Pro Max
];

// iPads open the app upright or sideways, so each size has both. Sizes in points, at 2x.
const IPAD_SCREENS = [
  [744, 1133], // iPad mini
  [820, 1180], // iPad (10th gen and later), iPad Air 11"
  [834, 1194], // iPad Pro 11" (earlier models)
  [834, 1210], // iPad Pro 11" (M4 and later)
  [1024, 1366], // iPad Air 13", iPad Pro 12.9"
  [1032, 1376], // iPad Pro 13" (M4 and later)
];

const ipadLaunchTags = IPAD_SCREENS.flatMap(([width, height]) => [
  `<link rel="apple-touch-startup-image" media="screen and (device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/admin/assets/launch-${width * 2}x${height * 2}.png" />`,
  `<link rel="apple-touch-startup-image" media="screen and (device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" href="/admin/assets/launch-${height * 2}x${width * 2}.png" />`,
]);

/** Tags for the <head> of every admin page, including the login page. */
export const APP_HEAD = [
  // viewport-fit=cover lets the dark top bar run under the status bar and Dynamic Island; the CSS adds the safe areas back.
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
  '<link rel="manifest" href="/admin/manifest.webmanifest" />',
  '<link rel="apple-touch-icon" href="/admin/assets/apple-touch-icon.png" />',
  ...LAUNCH_SCREENS.map((screen) => `<link rel="apple-touch-startup-image" media="screen and (device-width: ${screen.width}px) and (device-height: ${screen.height}px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/admin/assets/${screen.file}" />`),
  ...ipadLaunchTags,
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="Laura Admin" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  '<meta name="theme-color" content="#2A241F" />',
  // Stops iOS turning dates and prices into phone-number links.
  '<meta name="format-detection" content="telephone=no" />',
  '<link rel="preconnect" href="https://fonts.googleapis.com" />',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
].join("\n");

/** Shown by the service worker when a page can't load because there's no connection. Holds no client data. */
export const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#2A241F" />
<meta name="robots" content="noindex, nofollow" />
<title>Offline · Admin</title>
<style>
html, body { margin: 0; height: 100%; background: #2A241F; color: #FBF6F0; font-family: -apple-system, system-ui, sans-serif; -webkit-text-size-adjust: 100%; }
main { min-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center;
  padding: calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom)); }
h1 { margin: 0; font-family: Georgia, serif; font-size: 24px; font-weight: 600; }
p { margin: 0; color: #D9CFC2; font-size: 15px; line-height: 1.5; max-width: 30ch; }
button { margin-top: 8px; font: inherit; font-size: 16px; font-weight: 600; color: #FFF8F2; background: #B8714F; border: 0; border-radius: 12px; padding: 12px 22px; min-height: 44px; -webkit-tap-highlight-color: transparent; }
button:active { opacity: .85; }
</style>
</head>
<body>
<main>
  <h1>You're offline</h1>
  <p>Check your connection, then try again. A note you were writing is safe on this device until it's saved.</p>
  <button type="button" onclick="location.reload()">Try again</button>
</main>
</body>
</html>`;

const SHELL_FILES = [
  "/admin/offline",
  `/admin/assets/admin.js?v=${ASSET_VERSION}`,
  "/admin/assets/apple-touch-icon.png",
  "/admin/assets/icon-192.png",
];
const SHELL_VERSION = contentVersion(SHELL_FILES.join("|") + OFFLINE_HTML);

/** The service worker, served from /admin/sw.js with its scope widened to /admin. */
export const SERVICE_WORKER_JS = `// Laura Admin service worker. Keeps the app's own files on the phone for fast launches,
// shows an offline screen when there's no connection, and shows the email reminders.
// It never stores client pages or data.
const CACHE = "admin-shell-${SHELL_VERSION}";
const SHELL = ${JSON.stringify(SHELL_FILES)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("admin-shell-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Tuesday and Thursday reminders. The push carries no data, so the message is fixed here.
self.addEventListener("push", (event) => {
  event.waitUntil(self.registration.showNotification("Time for this week's email", {
    body: "Tap to write today's email to your clients.",
    icon: "/admin/assets/icon-192.png",
    badge: "/admin/assets/icon-192.png",
    tag: "campaign-reminder",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/admin/campaigns/new"));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pages always come from the network, so client details are never stored on the phone.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/admin/offline")));
    return;
  }

  // The app's own files are versioned, so a cached copy is always the right one.
  if (url.pathname.startsWith("/admin/assets/")) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then((hit) => hit || fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })),
      ),
    );
  }
});
`;
