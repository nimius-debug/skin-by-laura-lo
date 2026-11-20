// Site themes. The everyday look is the token block at the top of
// src/styles.js; a theme here is only a set of new values for those same
// tokens, so no page or component knows which theme is on.
//
// To add a theme: add an entry to THEMES with the tokens it changes, then a
// line to SCHEDULE saying when it is on. The page gets
// <html data-theme="<name>"> and the stylesheet carries the tokens under
// :root[data-theme="<name>"]. SITE_THEME in wrangler.toml forces one theme
// (or "everyday") regardless of the schedule.

/** Theme name → { label, themeColor (phone browser bar), tokens }. */
export const THEMES = {
  // Black Friday 2026: warm black and ivory with one champagne accent.
  "black-edition": {
    label: "Black Friday",
    scheme: "dark",
    themeColor: "#0c0c0b",
    tokens: {
      "--paper": "#0c0c0b",          // page ground: warm black, never pure #000
      "--cream": "#141412",          // section tint
      "--white": "#1b1a17",          // raised surface: cards, inputs
      "--ink": "#f3eee5",            // text: warm ivory (17:1 on the ground)
      "--muted": "#b3ada1",          // body copy (8.4:1)
      "--clay": "#d8c39b",           // champagne: italic headline words, links
      "--clay-deep": "#d8c39b",      // eyebrows
      "--sage": "#8f8a7d",
      "--line": "rgba(243, 238, 229, .14)",
      "--brass": "#d8c39b",
      "--brass-hi": "#ecdcb8",
      "--brass-deep": "#a99168",
      "--on-dark": "#f3eee5",
      "--on-dark-muted": "#b3ada1",
      "--mahogany": "#141412",
      "--shadow": "#000000",
      "--panel-taupe": "#1b1a17",
      "--panel-stone": "#1b1a17",
      "--panel-sage": "#1b1a17",
      // Product photos are shot on their own light backdrops; keep their tiles light.
      "--panel-product": "#e8e3d9",
      "--band": "#070706",           // announcement bar, footer, marquee
      "--on-band": "#f3eee5",
      "--inverse-bg": "#f3eee5",     // filled chips, active pills, bag count
      "--inverse-fg": "#0c0c0b",
      "--btn-bg": "#f3eee5",         // main buttons: solid ivory, no gradient
      "--btn-fg": "#0c0c0b",
      "--on-brass": "#0c0c0b",
      "--header-bg": "rgba(12, 12, 11, .94)",
      "--logo-filter": "invert(1) sepia(.15) brightness(1.18)",
    },
  },
};

/**
 * When each theme is on, first match wins. `when(cfg)` reads the request's
 * settings (src/config.js), so a theme follows the same clock, preview links
 * and kill switch as the campaign it belongs to.
 */
export const SCHEDULE = [
  { theme: "black-edition", when: (cfg) => Boolean(cfg.campaign) },
];

/** The theme for this request, or null for the everyday look. */
export function activeTheme(cfg, env = {}) {
  const forced = String(env.SITE_THEME || "").trim();
  if (forced) return THEMES[forced] ? forced : null;
  const entry = SCHEDULE.find((item) => item.when(cfg));
  return entry && THEMES[entry.theme] ? entry.theme : null;
}

/** :root[data-theme="…"] blocks for every theme, appended to the stylesheet. */
export function themeCss() {
  return Object.entries(THEMES).map(([name, theme]) => {
    const lines = Object.entries(theme.tokens).map(([token, value]) => `  ${token}: ${value};`).join("\n");
    return `:root[data-theme="${name}"] {\n  color-scheme: ${theme.scheme || "light"};\n${lines}\n}`;
  }).join("\n");
}
