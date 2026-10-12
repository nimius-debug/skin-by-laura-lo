import { PDFDocument } from "pdf-lib";
import { splitPdfPages, diffPages, hashImageBytes } from "../src/admin/pdf.js";
import { planNoteEntries, formulationsFor, planInsight } from "../src/admin/claude.js";
import { syncWindows, isCountableBooking } from "../src/admin/sync.js";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

async function buildNotebook(entries) {
  const doc = await PDFDocument.create();
  for (const text of entries) {
    const page = doc.addPage([200, 200]);
    page.drawText(text, { x: 10, y: 150 });
  }
  return doc.save();
}

// --- page splitting + hash stability ----------------------------------
const notebookV1 = await buildNotebook(["Visit on Aug 2", "Visit on Sep 14", "Visit on Oct 3"]);
const pagesV1 = await splitPdfPages(notebookV1);
check("splits a 3-page notebook into 3 pages", pagesV1.length, 3);

const pagesV1Again = await splitPdfPages(notebookV1);
check(
  "re-splitting the same unchanged bytes gives identical hashes",
  pagesV1.map((p) => p.hash),
  pagesV1Again.map((p) => p.hash),
);

// --- a page with an embedded image hashes too, not just text content ---
const withImage = await PDFDocument.create();
const imgPage = withImage.addPage([200, 200]);
const png = await withImage.embedPng(PNG_1X1);
imgPage.drawImage(png, { x: 0, y: 0, width: 50, height: 50 });
const [imagePageHash] = (await splitPdfPages(await withImage.save())).map((p) => p.hash);
check("an image-only page still produces a hash", typeof imagePageHash, "string");
check("page hashes look like sha256 hex", /^[0-9a-f]{64}$/.test(pagesV1[0].hash), true);

// --- appending a page at the end is detected as exactly one new page ---
const appendDoc = await PDFDocument.create();
const sourceForCopy = await PDFDocument.load(notebookV1);
const copied = await appendDoc.copyPages(sourceForCopy, [0, 1, 2]);
copied.forEach((p) => appendDoc.addPage(p));
appendDoc.addPage().drawText("Visit on Nov 1 - new", { x: 10, y: 150 });
const notebookV2 = await appendDoc.save();
const pagesV2 = await splitPdfPages(notebookV2);

const knownHashes = pagesV1.map((p) => p.hash);
const { newPages, missingHashes } = diffPages(pagesV2, knownHashes);
check("exactly one genuinely new page is detected after appending", newPages.length, 1);
check("no previously-seen page is reported missing", missingHashes.length, 0);

// --- a page going missing from a later export is flagged, not silently dropped ---
const droppedDoc = await PDFDocument.create();
const sourceForDrop = await PDFDocument.load(notebookV1);
const [kept1, kept3] = await droppedDoc.copyPages(sourceForDrop, [0, 2]);
droppedDoc.addPage(kept1);
droppedDoc.addPage(kept3);
const incompleteExport = await droppedDoc.save();
const pagesIncomplete = await splitPdfPages(incompleteExport);
const droppedDiff = diffPages(pagesIncomplete, knownHashes);
check("dropping a previously-seen page finds no new pages", droppedDiff.newPages.length, 0);
check("dropping a previously-seen page is flagged as missing", droppedDiff.missingHashes.length, 1);

// --- reordering pages does not confuse the hash-based diff ------------
const reorderedDoc = await PDFDocument.create();
const sourceForReorder = await PDFDocument.load(notebookV1);
const [r1, r2, r3] = await reorderedDoc.copyPages(sourceForReorder, [2, 0, 1]);
reorderedDoc.addPage(r1);
reorderedDoc.addPage(r2);
reorderedDoc.addPage(r3);
const reorderedExport = await reorderedDoc.save();
const reorderedDiff = diffPages(await splitPdfPages(reorderedExport), knownHashes);
check("reordering already-seen pages finds no new pages", reorderedDiff.newPages.length, 0);
check("reordering already-seen pages reports nothing missing", reorderedDiff.missingHashes.length, 0);

// --- plain image uploads (Noteful's "Image" export) hash their raw bytes ---
const imageHashA = await hashImageBytes(PNG_1X1);
const imageHashB = await hashImageBytes(PNG_1X1);
check("identical image bytes hash identically", imageHashA, imageHashB);
check("image hash looks like sha256 hex", /^[0-9a-f]{64}$/.test(imageHashA), true);

// --- Claude's note-splitting response is parsed defensively ------------
const wellFormed = planNoteEntries(JSON.stringify({
  entries: [
    { pageIndexes: [0], date: "2026-08-02", summary: "First visit.", text: "First visit notes.", confidence: "high" },
    { pageIndexes: [1, 2], date: null, summary: "Follow-up, no date legible.", text: "Follow-up notes.", confidence: "low" },
  ],
}));
check("parses a well-formed multi-entry response", wellFormed.length, 2);
check("missing date is kept null rather than defaulted", wellFormed[1].date, null);
check("low-confidence flag is preserved", wellFormed[1].confidence, "low");

const malformed = planNoteEntries("not json at all");
check("a malformed response falls back to one low-confidence entry instead of throwing", malformed.length, 1);
check("the fallback entry is flagged low-confidence for manual review", malformed[0].confidence, "low");

// --- Square booking sync: windowing and the "gotten a service" filter ---
const windows90 = syncWindows("2026-01-01T00:00:00Z", "2026-04-01T00:00:00Z");
check("a ~90-day range splits into windows no longer than 31 days", windows90.every((w) => (new Date(w.end) - new Date(w.start)) <= 31 * 24 * 60 * 60 * 1000), true);
check("windows are contiguous with no gaps", windows90.slice(1).every((w, i) => w.start === windows90[i].end), true);
check("the last window ends exactly at the requested end", windows90[windows90.length - 1].end, "2026-04-01T00:00:00.000Z");
check("an empty range produces no windows", syncWindows("2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z").length, 0);

const NOW = "2026-10-11T00:00:00Z";
check(
  "a past, accepted booking counts as a service received",
  isCountableBooking({ status: "ACCEPTED", start_at: "2026-09-01T00:00:00Z" }, NOW),
  true,
);
check(
  "a future booking (even accepted) does not count yet",
  isCountableBooking({ status: "ACCEPTED", start_at: "2026-12-01T00:00:00Z" }, NOW),
  false,
);
check(
  "a cancelled booking never counts",
  isCountableBooking({ status: "CANCELLED_BY_CUSTOMER", start_at: "2026-09-01T00:00:00Z" }, NOW),
  false,
);
check(
  "a no-show never counts",
  isCountableBooking({ status: "NO_SHOW", start_at: "2026-09-01T00:00:00Z" }, NOW),
  false,
);

// --- client insight: routine products carry their real formulation data ---
const formulations = formulationsFor([
  { name: "CBD SKIN MIST", slug: "cbd-skin-mist" },
  { name: "Totally Made Up Product Name", slug: "made-up" },
]);
check("a reviewed product's formulation summary is included", formulations.includes("A watery toning mist"), true);
check("a reviewed product's bestFor guidance is included", formulations.includes("Best for:"), true);
check("a product with no formula on file is labelled honestly, not skipped", formulations.includes("Totally Made Up Product Name: no formula on file yet."), true);
check("an empty routine never calls into the formula lookup", formulationsFor([]), "");

const insight = planInsight(JSON.stringify({
  overview: "  Oily, reacts to strong actives.  ",
  visits: [
    { date: "2026-03-02", treatment: "Gentle peel", response: "Calm, no redness" },
    { date: null, treatment: "Facial", response: "" },
    { date: "2026-05-10", treatment: "", response: "Mild sting" },
    { date: "2026-06-01", treatment: "", response: "" },
  ],
  products: [{ name: "Toning mist", note: "Hydrates" }, { name: "", note: "dropped" }],
  watch: ["Redness after acids", "  "],
  nextVisit: ["Check hydration"],
}));
check("planInsight keeps the overview, trimmed", insight.overview, "Oily, reacts to strong actives.");
check("planInsight labels a visit with no date as Undated", insight.visits[1].date, "Undated");
check("planInsight drops a visit with nothing in it", insight.visits.length, 3);
check("planInsight drops a product with no name", insight.products, [{ name: "Toning mist", note: "Hydrates" }]);
check("planInsight drops blank list items", insight.watch, ["Redness after acids"]);
check("planInsight reads a fenced json block", planInsight("```json\n{\"overview\": \"Fenced.\"}\n```").overview, "Fenced.");
check("planInsight keeps plain text as the overview when it isn't JSON", planInsight("Just prose here.").overview, "Just prose here.");
check("planInsight gives an empty reply a plain placeholder", planInsight("").overview, "Nothing to summarize yet.");
check("planInsight fills in empty lists when the reply omits them", planInsight("{\"overview\": \"x\"}").visits, []);

console.log(failures === 0 ? "\nAll admin-notes tests passed." : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
