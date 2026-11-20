// Skincare Guide drafts and the guide editor (src/admin/guides/).
import { createD1, schemaMigrations } from "./helpers/d1-sqlite.mjs";
import { cleanDocument, itemsToCheck, plainText, safeImageSrc, sanitizeHtml } from "../src/admin/guides/model.js";
import { buildGuideDraft, matchProducts, planRoutine, wordingChoices } from "../src/admin/guides/build.js";
import { guideElementHtml, FONT_CSS } from "../src/admin/guides/render.js";
import { GUIDE_EDITOR_JS } from "../src/admin/guides/editor-client.js";
import { guideEditorPage, clientGuidesCard } from "../src/admin/guides/page.js";
import { handleGuideRoute } from "../src/admin/guides/routes.js";
import * as store from "../src/admin/guides/store.js";
import { guideProductFor } from "../src/data/guide-library.js";
import { toString } from "../src/html.js";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

const item = (name, step = "treat") => ({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), image: `https://items-images.example.com/${encodeURIComponent(name)}.png`, step });
const MARLINE = [
  item("Corthe Dermo Essential Cleansing Oil", "cleanse"),
  item("Dermathod Moist Morning Touch Foam Cleanser", "cleanse"),
  item("Mixi Dew Drops"),
  item("Corthe Dermo Essential Rich M Cream", "moisturize"),
  item("Pfect-A Solar Elixir Serum Sunscreen", "protect"),
  item("Corthe Dermo Pure Spot For Night"),
];
const textOf = (page) => page.elements.filter((e) => e.type === "text").map((e) => plainText(e.html));

// --- markup safety ------------------------------------------------------------
{
  check("only bold, italic, underline and line breaks survive, without attributes",
    sanitizeHtml('<b onclick="x()">Hi</b> <script>alert(1)</script><i>there</i><br/><img src=x onerror=alert(1)><a href="javascript:x">link</a>'),
    "<b>Hi</b> alert(1)<i>there</i><br>link");
  check("<strong> and <em> become <b> and <i>", sanitizeHtml("<strong>a</strong><em>b</em>"), "<b>a</b><i>b</i>");
  check("stray angle brackets are escaped, existing entities kept", sanitizeHtml("1 < 2 &amp; 3 > 2 & so"), "1 &lt; 2 &amp; 3 &gt; 2 &amp; so");
  check("tags left open are closed, closers with no opener dropped", sanitizeHtml("<b>bold <i>both</b> tail</u>"), "<b>bold <i>both</i></b><i> tail</i>");
  check("images only from the shop's /media folder or https",
    [safeImageSrc("/media/guides/cover-room.jpg"), safeImageSrc("https://items-images.example.com/a.png"), safeImageSrc("javascript:alert(1)"),
      safeImageSrc("http://example.com/a.png"), safeImageSrc("/media/../secrets"), safeImageSrc('https://x.com/a.png" onerror="x')],
    ["/media/guides/cover-room.jpg", "https://items-images.example.com/a.png", null, null, null, null]);

  const dirty = {
    clientName: "Sofia", pages: [{
      id: "p1", kind: "nonsense", elements: [
        { id: "a", type: "text", x: "12.345", y: 1e9, w: -5, html: "<div>hi</div>", style: { fontSize: 9999, font: "comic", color: "red", align: "middle" }, origin: "library" },
        { id: "b", type: "image", x: 0, y: 0, w: 10, h: 10, src: "data:image/png;base64,AAAA" },
        { id: "c", type: "video", x: 0, y: 0, w: 10 },
        { id: "bad id!", type: "line", x: 1, y: 2, w: 3, origin: "hacker", style: { strokeWidth: 2 } },
      ],
    }],
  };
  const clean = cleanDocument(dirty);
  check("a saved page keeps only known page kinds", clean.pages[0].kind, "blank");
  check("numbers are clamped onto (or near) the page and styles kept to known values",
    clean.pages[0].elements[0], { id: "a", type: "text", x: 12.35, y: 2246, w: 1, html: "hi", style: { fontSize: 240 }, origin: "library" });
  check("images that aren't from the shop or https, and unknown box types, are dropped", clean.pages[0].elements.map((e) => e.id), ["a", "x3"]);
  check("an unknown origin becomes 'edited'", clean.pages[0].elements[1].origin, "edited");
  check("something that isn't a guide is refused", [cleanDocument(null), cleanDocument({ pages: "no" })], [null, null]);
}

// --- matching and the routine plan -----------------------------------------------
{
  const products = matchProducts([...MARLINE, item("Corthe Dermo Essential Cleansing Oil 200ml", "cleanse"), item("Mystery Glow Oil", "other")]);
  check("Square names are matched to library entries", products.slice(0, 2).map((p) => p.entry?.id), ["corthe-cleansing-oil", "dermathod-moist-foam-cleanser"]);
  check("a product not in the library keeps its Square name and has no entry", [products.at(-1).name, products.at(-1).entry], ["Mystery Glow Oil", null]);

  const { am, pm } = planRoutine(products);
  const steps = (list) => list.map(({ step, product }) => `${step}:${product.entry?.id || product.name}`);
  check("morning: water cleanser, serum, moisturizer, SPF last; no oil cleanse or spot treatment", steps(am),
    ["cleanse:dermathod-moist-foam-cleanser", "serum:mixi-dew-drops", "moisturize:corthe-rich-m-cream", "protect:pfect-a-solar-elixir"]);
  check("night: oil first, the water cleanser second, spot treatment last, no SPF", steps(pm),
    ["firstCleanse:corthe-cleansing-oil", "secondCleanse:dermathod-moist-foam-cleanser", "serum:mixi-dew-drops", "moisturize:corthe-rich-m-cream", "spot:corthe-spot-for-night"]);

  const acne = planRoutine(matchProducts([item("Dermathod Moist Morning Touch Foam Cleanser"), item("Mixi Clear Plex 2.8%"), item("Mixi Mandelic Acid 8%")]));
  check("without an oil, the water cleanser is the night cleanse", acne.pm[0].step, "cleanse");
  check("Clear Plex is night only; mandelic is morning and night",
    [acne.am.some((s) => s.product.entry.id === "mixi-clear-plex-2-8"), acne.pm.some((s) => s.product.entry.id === "mixi-clear-plex-2-8"), acne.am.some((s) => s.product.entry.id === "mixi-mandelic-8")],
    [false, true, true]);
}

// --- the draft ----------------------------------------------------------------
{
  const doc = buildGuideDraft({ clientName: "Sofia Ramirez", routine: { items: [...MARLINE, item("Mystery Glow Oil", "other")], orderedAt: "2026-10-01T12:00:00Z" } });
  check("a draft has the cover, the overview, AM and PM", doc.pages.map((p) => p.kind), ["cover", "overview", "am", "pm"]);
  check("the cover greets her by first name", textOf(doc.pages[0])[0], "Sofia’s");
  check("the personal note is a placeholder marked for a look", doc.pages[0].elements.find((e) => e.role === "note").origin, "check");
  check("the note ends with Laura's sign-off", plainText(doc.pages[0].elements.find((e) => e.role === "note").html).endsWith("With love,\nLaura Lo"), true);

  const oil = guideProductFor("Corthe Cleansing Oil");
  const why = doc.pages[1].elements.filter((e) => e.role === "why");
  check("'Why these products?' uses Laura's description word for word", plainText(why[0].html), `${oil.name}\n${oil.why}`);
  check("library text is marked as hers", why[0].origin, "library");
  check("a product the library doesn't know gets a 'description needed' box to check",
    [plainText(why.at(-1).html).startsWith("Mystery Glow Oil\nDescription needed"), why.at(-1).origin], [true, "check"]);
  check("photos in the routine grid come from Square", doc.pages[1].elements.filter((e) => e.role === "product-photo").length, 6);

  const am = textOf(doc.pages[2]);
  check("the AM list names each step and product", am[1].split("\n"), ["1. Cleanse—Moist Foam Cleanser", "2. Serum—Mixi Dew Drops", "3. Moisturize—Rich M Cream", "4. SPF—Pfect-A Solar Elixir"]);
  check("cleanser how-to says a nickel-size amount", am.find((t) => t.startsWith("CLEANSE\n")).includes("nickel-size amount"), true);
  check("the SPF page gets the two finger rule tip and its photo",
    [am.some((t) => t.startsWith("APPLICATION TIP")), doc.pages[2].elements.some((e) => e.src === "/media/guides/spf-two-fingers.png")], [true, true]);
  check("the PM page has no SPF tip", textOf(doc.pages[3]).some((t) => t.startsWith("APPLICATION TIP")), false);
  check("every page has the Skin by Laura Lo footer", doc.pages.every((p) => p.elements.some((e) => e.role === "footer")), true);
  check("the draft is laid out again once the editor can measure it", doc.needsLayout, true);
  check("what still needs a look: the note and the unknown product", itemsToCheck(doc).length, 2);
  check("element ids are unique across the guide", new Set(doc.pages.flatMap((p) => p.elements.map((e) => e.id))).size, doc.pages.reduce((n, p) => n + p.elements.length, 0));
  check("a draft passes its own save checks unchanged", JSON.stringify(cleanDocument(doc)), JSON.stringify(cleanDocument(cleanDocument(doc))));

  const notes = buildGuideDraft({ clientName: "Ana", routine: { items: [item("Mixi Clear Plex 2.8%"), item("Mixi Mandelic Acid 8%")] } });
  const notesPage = notes.pages.find((p) => p.kind === "notes");
  check("Clear Plex and mandelic bring their notes page", textOf(notesPage).map((t) => t.split("\n")[0]),
    ["Good to know", "GUIDE TO USING CLEAR PLEX", "PRO TIP: PURGING IS A NORMAL PART OF THE ACNE CLEARING PROCESS", "NOTE: MOVING UP TO A STRONGER MANDELIC", "Skin by Laura Lo"]);
  check("Clear Plex's two written versions are flagged so Laura picks one", notesPage.elements.find((e) => e.role === "snippet").origin, "check");
  check("two treatments in one step are told apart by name", textOf(notes.pages.find((p) => p.kind === "pm")).filter((t) => t.startsWith("TREAT")).map((t) => t.split("\n")[0]),
    ["TREAT — CLEAR PLEX 2.8%", "TREAT — MANDELIC 8%"]);

  const empty = buildGuideDraft({ clientName: "", routine: null });
  check("with no products the draft still has the cover and both routine pages", empty.pages.map((p) => p.kind), ["cover", "overview", "am", "pm"]);

  const choices = wordingChoices(doc);
  check("other wordings Laura has used are offered for a product", choices["corthe-cleansing-oil"].texts.length, 1 + oil.whyAlternates.length);
}

// --- drawing ------------------------------------------------------------------
{
  const markup = guideElementHtml({ id: "a", type: "image", x: 1, y: 2, w: 3, h: 4, src: 'https://x.com/a.png"><script>', alt: '"><b>', fit: "cover", style: {}, origin: "library" }, FONT_CSS);
  check("image addresses and alt text can't break out of their attributes", markup.includes("<script>") || markup.includes('"><b>'), false);
  const text = guideElementHtml({ id: "t", type: "text", x: 0, y: 0, w: 100, html: "<b>Hi</b>", style: { font: "script", fontSize: 20, uppercase: true }, origin: "check", note: "Look" }, FONT_CSS);
  check("a text box carries its font, size and review mark", [text.includes("Allura"), text.includes("font-size:20px"), text.includes('data-origin="check"'), text.includes("<b>Hi</b>")], [true, true, true, true]);
  let parses = true;
  try { new Function(GUIDE_EDITOR_JS); } catch { parses = false; }
  check("the editor script is valid JavaScript", parses, true);
}

// --- storage and routes -------------------------------------------------------
{
  const env = { CLIENT_NOTES_DB: createD1({ migrations: schemaMigrations() }) };
  await env.CLIENT_NOTES_DB.prepare("INSERT INTO clients (id, name, square_customer_id) VALUES ('c1', 'Sofia <Ramirez>', 'sq1')").run();
  const loadClientPurchases = async () => ({ routine: { items: MARLINE, orderedAt: "2026-10-01T12:00:00Z" }, purchasesFailed: false });
  const route = (method, path, body) => handleGuideRoute(
    new Request(`https://x.test${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }),
    env, new URL(`https://x.test${path}`), path.split("/").filter(Boolean), method, { loadClientPurchases },
  );

  const created = await route("POST", "/admin/clients/c1/guides");
  const location = created.headers.get("location");
  check("Create guide drafts one and opens it", [created.status, /^\/admin\/guides\/guide_[0-9a-f]{32}$/.test(location)], [303, true]);
  const id = location.split("/").pop();

  const editor = await route("GET", `/admin/guides/${id}`);
  const page = await editor.text();
  check("the editor opens with the guide's pages and its script", [editor.status, page.includes('class="sheet"'), page.includes("/admin/assets/guide-editor.js?v=")], [200, true, true]);
  check("the client's name is escaped on the editor page", [page.includes("Sofia <Ramirez>"), page.includes("Sofia &lt;Ramirez&gt;")], [false, true]);
  check("the guide data can't close its script tag", page.split('<script type="application/json"')[1].split("</script>")[0].includes("<"), false);
  check("there's nothing unsafe on the page: no script but the editor's",
    (page.match(/<script/g) || []).length, 2);

  const guide = await store.getGuide(env, id);
  const doc = guide.document;
  doc.pages[0].elements.find((e) => e.role === "note").html = "Hi Sofia!<script>alert(1)</script>";
  const saved = await route("POST", `/admin/guides/${id}`, { document: doc, version: guide.version });
  check("saving returns the next version", [saved.status, (await saved.json()).version], [200, 2]);
  const after = await store.getGuide(env, id);
  check("the saved note is cleaned of anything but text", after.document.pages[0].elements.find((e) => e.role === "note").html, "Hi Sofia!alert(1)");

  const stale = await route("POST", `/admin/guides/${id}`, { document: doc, version: 1 });
  check("a save from an out-of-date tab is refused, not overwritten", stale.status, 409);
  const garbage = await route("POST", `/admin/guides/${id}`, "not a guide");
  check("a save that isn't a guide is refused", garbage.status, 400);

  check("her guides are listed for her page", (await store.listGuidesForClient(env, "c1")).map((g) => g.id), [id]);
  const card = toString(clientGuidesCard({ client: { id: "c1" }, guides: await store.listGuidesForClient(env, "c1") }));
  check("the guides card links to the guide and has a Create guide button",
    [card.includes(`href="/admin/guides/${id}"`), card.includes('action="/admin/clients/c1/guides"'), card.includes("Create guide")], [true, true, true]);

  const failed = await handleGuideRoute(new Request("https://x.test/admin/clients/c1/guides", { method: "POST" }), env, new URL("https://x.test/admin/clients/c1/guides"),
    ["admin", "clients", "c1", "guides"], "POST", { loadClientPurchases: async () => ({ routine: null, purchasesFailed: true }) });
  check("no draft is made when her purchases can't be read", [failed.status, (await store.listGuidesForClient(env, "c1")).length], [502, 1]);
  check("an unknown client gets no guide", await route("POST", "/admin/clients/nobody/guides"), null);

  const deleted = await route("POST", `/admin/guides/${id}/delete`);
  check("deleting goes back to her page and removes the guide", [deleted.headers.get("location"), await store.getGuide(env, id)], ["/admin/clients/c1", null]);
  check("a deleted guide's page is not found", await route("GET", `/admin/guides/${id}`), null);
  check("the editor page renders without a client", guideEditorPage({ guide: { id: "g", version: 1, document: buildGuideDraft({ clientName: "Mo", routine: null }) }, client: null }).includes("Mo&#39;s Skincare Guide"), true);
}

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll guide checks passed");
