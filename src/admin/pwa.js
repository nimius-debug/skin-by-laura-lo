// Makes the admin installable as a Home Screen app on an iPhone (Safari: Share, Add to Home Screen).
// The manifest and icons are public on purpose: the phone fetches them without the login cookie,
// and they contain nothing but the app's name, colours and icon.

export const MANIFEST = {
  name: "Laura — Admin",
  short_name: "Laura Admin",
  id: "/admin",
  start_url: "/admin",
  scope: "/admin",
  display: "standalone",
  background_color: "#FBF6F0",
  theme_color: "#2A241F",
  icons: [
    { src: "/admin/assets/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/admin/assets/icon-512.png", sizes: "512x512", type: "image/png" },
  ],
};

/** Tags for the <head> of every admin page, including the login page. */
export const APP_HEAD = `<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="manifest" href="/admin/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/admin/assets/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Laura Admin" />
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
<meta name="theme-color" content="#2A241F" />`;
