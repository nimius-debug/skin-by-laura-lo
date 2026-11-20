// Resource pages in Skincare Guides (src/data/guide-resources.js, src/admin/guides/resources.js):
// which ones a draft gets and why, where they go, and that they survive a save.
import { existsSync } from "node:fs";
import { createD1, schemaMigrations } from "./helpers/d1-sqlite.mjs";
import { GUIDE_RESOURCES, RESOURCE_ORDER } from "../src/data/guide-resources.js";
import { AFTER_COVER, addResourcesToDraft, pickResources, placeResourcePages, resourceCatalog, resourcePages } from "../src/admin/guides/resources.js";
import { buildGuideDraft, idMaker } from "../src/admin/guides/build.js";
import { cleanDocument, itemsToCheck, plainText } from "../src/admin/guides/model.js";
import { guideElementHtml, FONT_CSS } from "../src/admin/guides/render.js";
import { handleGuideRoute } from "../src/admin/guides/routes.js";
import * as store from "../src/admin/guides/store.js";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}
const ids = (picks) => picks.map((pick) => pick.id);
// JSON with keys in a fixed order, so two copies compare by content.
const canonical = (value) => JSON.stringify(value, (key, inner) => (inner && typeof inner === "object" && !Array.isArray(inner)
  ? Object.fromEntries(Object.keys(inner).sort().map((name) => [name, inner[name]])) : inner));
const kinds = (doc) => doc.pages.map((page) => page.resource || page.kind);

// --- the pages themselves -------------------------------------------------------
{
  check("every resource has a name, a line about it and at least one page",
    GUIDE_RESOURCES.every((r) => r.label && r.about && r.pages.length > 0), true);
  check("resource ids are unique", new Set(RESOURCE_ORDER).size, RESOURCE_ORDER.length);
  const photos = GUIDE_RESOURCES.flatMap((r) => r.pages.flatMap((page) => page.elements.filter((e) => e.type === "image").map((e) => e.src)));
  check("every photo is in the shop's media folder", photos.filter((src) => !existsSync(new URL(`../public${src}`, import.meta.url))), []);

  const catalog = resourceCatalog();
  const all = catalog.flatMap((resource) => resource.pages);
  check("every resource page passes the save checks unchanged",
    all.every((page) => canonical(cleanDocument({ pages: [page] }).pages[0]) === canonical(page)), true);
  check("every resource page has the Skin by Laura Lo footer", all.every((page) => page.elements.some((e) => e.role === "footer")), true);
  check("text boxes stay on the sheet", all.flatMap((page) => page.elements).filter((e) => e.type === "text" && (e.x < 0 || e.x + e.w > 794 || e.y < 0 || e.y > 1123)).length, 0);
  check("stacked boxes belong to a flow their page declares",
    all.every((page) => page.elements.every((e) => !e.flow || (page.flows && page.flows[e.flow]))), true);
  check("the makeup lists are three pages", catalog.find((r) => r.id === "makeup").pages.length, 3);
  check("pages copied from US Letter are stretched to A4 (What is Acne's causes start lower)",
    catalog.find((r) => r.id === "what-is-acne").pages[0].elements.find((e) => plainText(e.html) === "AND ITS CAUSES").y, Math.round(413 * 1123 / 1028));
  check("Laura's words are marked as hers", all.flatMap((page) => page.elements).filter((e) => e.type === "text" && e.role !== "footer" && e.role !== "appointment").every((e) => e.origin === "library"), true);
  check("the next-appointment line is left for her to fill in",
    catalog.find((r) => r.id === "post-treatment").pages[0].elements.find((e) => e.role === "appointment").origin, "check");

  const essentials = catalog.find((r) => r.id === "essentials").pages[0];
  const links = essentials.elements.filter((e) => e.link);
  check("the shop buttons keep their links", links.length, 6);
  const button = guideElementHtml(links[0], FONT_CSS);
  check("a linked box opens its link from the PDF", button.includes(`<a class="el-link" href="${links[0].link}" target="_blank" rel="noopener">`), true);
  check("links that aren't plain https are dropped on save",
    cleanDocument({ pages: [{ id: "p", kind: "resource", resource: "x", elements: [{ ...links[0], link: "javascript:alert(1)" }] }] }).pages[0].elements[0].link, undefined);
  check("a resource name that isn't an id is dropped on save",
    cleanDocument({ pages: [{ id: "p", kind: "resource", resource: "<b>", elements: [] }] }).pages[0].resource, undefined);

  const checked = resourcePages(idMaker("z"), "hormones", { reason: "Picked for her because of “jawline”." });
  const title = checked[0].elements.find((e) => e.role === "title");
  check("a page picked for her has its title highlighted with the reason", [title.origin, title.note], ["check", "Picked for her because of “jawline”."]);
}

// --- choosing pages --------------------------------------------------------------
{
  const visit = {
    source: "noteful", note_date: "2026-11-15",
    extracted_text: "Treatment type: - green enzyme + oxy mask / - extraction / - blue peel / Notes: - Jawline cystic Breakouts / + nodules / - Rosacea prone",
  };
  const form = {
    source: "form", note_date: null,
    extracted_text: "Facial Intake Form:\n- Skin priorities: Acne\n- Wears makeup: Concealer, powder\n- Medications or treatments affecting skin: Birth control / Anticonceptivos\n- No health conditions listed\n- Takes: Zinc, fish oil\n- Not pregnant or nursing",
  };
  const today = new Date("2026-11-20T12:00:00Z");
  const picks = pickResources({ notes: [visit, form], products: [], today });
  check("pages are picked from her notes and intake form, in the guide's order",
    ids(picks), ["what-is-acne", "tips", "essentials", "hormones", "birth-control", "supplements", "rosacea", "makeup", "post-treatment"]);
  const reason = (id) => picks.find((pick) => pick.id === id).reason;
  check("each picked page says what triggered it and where", reason("hormones").startsWith("Picked for her because of “Jawline cystic Breakouts” in her notes from Nov 15, 2026."), true);
  check("the intake form is named as the source", reason("birth-control").includes("in her intake form"), true);
  check("Laura's tips and essentials come in every guide, without a highlight", [reason("tips"), reason("essentials")], ["", ""]);

  const negatives = pickResources({ notes: [{ source: "form", extracted_text: "- Skin priorities: Acne\n- Doesn't wear makeup regularly\n- No health conditions listed\n- Not pregnant or nursing\n- Medications or treatments affecting skin: None" }] });
  check("“No …” and “Doesn't …” answers don't pick a page", ids(negatives), ["what-is-acne", "tips", "essentials"]);
  check("acne-only pages need acne: makeup alone isn't enough",
    ids(pickResources({ notes: [{ source: "form", extracted_text: "- Skin priorities: Fine lines\n- Wears makeup: Foundation" }] })), ["tips", "essentials"]);
  check("an acne product in her routine counts as acne",
    pickResources({ products: ["Mixi Mandelic 8%"] }).find((pick) => pick.id === "what-is-acne").reason.startsWith("Picked for her because her routine has Mixi Mandelic 8%."), true);
  check("the client summary is read too",
    pickResources({ insight: { overview: "Hormonal breakouts along the jaw.", flags: [] } }).find((pick) => pick.id === "hormones").reason.includes("her client summary"), true);
  check("an old peel doesn't bring the post-treatment page", ids(pickResources({ notes: [visit], today: new Date("2027-03-01T12:00:00Z") })).includes("post-treatment"), false);
  check("a guide for a friend gets the tips and essentials only", ids(pickResources()), ["tips", "essentials"]);
}

// --- where pages go ---------------------------------------------------------------
{
  const draft = buildGuideDraft({ clientName: "Sofia", routine: null });
  addResourcesToDraft(draft, [{ id: "post-treatment", reason: "x" }, { id: "what-is-acne", reason: "y" }, { id: "hormones", reason: "z" }, { id: "tips", reason: "" }]);
  check("What is Acne goes after the cover, the rest after the routine in Marline's order",
    kinds(draft), ["cover", "what-is-acne", "overview", "am", "pm", "tips", "hormones", "post-treatment"]);
  check("picked pages are listed to check", itemsToCheck(cleanDocument(draft)).length, 1 + 3 + 1);

  const at = placeResourcePages(draft.pages, "lifestyle", resourcePages(idMaker("q"), "lifestyle"), RESOURCE_ORDER, AFTER_COVER);
  check("a page added later slots in by the same order", [at, kinds(draft).slice(5, 8)], [6, ["tips", "lifestyle", "hormones"]]);
  draft.pages.splice(5, 1);
  placeResourcePages(draft.pages, "essentials", resourcePages(idMaker("q2"), "essentials"), RESOURCE_ORDER, AFTER_COVER);
  check("with the pages before it deleted, it goes after the routine", kinds(draft).slice(4, 7), ["pm", "essentials", "lifestyle"]);
  const blank = { id: "b", kind: "blank", elements: [] };
  draft.pages.push(blank);
  placeResourcePages(draft.pages, "makeup", resourcePages(idMaker("q3"), "makeup"), RESOURCE_ORDER, AFTER_COVER);
  check("all of a resource's pages go in together, before a blank page she added at the end", kinds(draft).slice(-5), ["makeup", "makeup", "makeup", "post-treatment", "blank"]);
}

// --- a draft from the dashboard ------------------------------------------------------
{
  const env = { CLIENT_NOTES_DB: createD1({ migrations: schemaMigrations() }) };
  await env.CLIENT_NOTES_DB.prepare("INSERT INTO clients (id, name, square_customer_id) VALUES ('c1', 'Sofia Ramirez', 'sq1')").run();
  await env.CLIENT_NOTES_DB.prepare("INSERT INTO notes (id, client_id, note_date, summary, extracted_text, source) VALUES ('n1', 'c1', '2025-06-01', 'facial', ?, 'noteful')")
    .bind("Notes: - hormonal breakouts on chin / - on spironolactone").run();
  const loadClientPurchases = async () => ({ routine: { items: [{ name: "Mixi Dew Drops", slug: "dew", step: "treat" }], orderedAt: null }, purchasesFailed: false });
  const created = await handleGuideRoute(new Request("https://x.test/admin/clients/c1/guides", { method: "POST" }), env, new URL("https://x.test/admin/clients/c1/guides"),
    ["admin", "clients", "c1", "guides"], "POST", { loadClientPurchases });
  const id = created.headers.get("location").split("/").pop();
  const guide = await store.getGuide(env, id);
  check("Create guide adds the pages her notes call for", kinds(guide.document), ["cover", "what-is-acne", "overview", "am", "pm", "tips", "essentials", "hormones"]);
  const editor = await (await handleGuideRoute(new Request(`https://x.test/admin/guides/${id}`), env, new URL(`https://x.test/admin/guides/${id}`),
    ["admin", "guides", id], "GET", { loadClientPurchases })).text();
  check("the editor has a + Page button and the list of pages", [editor.includes('data-action="add-page"'), editor.includes('"id":"rosacea"'), editor.includes('class="picker pages-dialog')], [true, true, true]);
}

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll guide resource checks passed");
