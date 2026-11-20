// Cut-out product photos in Skincare Guides (src/data/product-cutouts.js, scripts/product-cutouts.py).
import { existsSync, readdirSync } from "node:fs";
import { CUTOUTS } from "../src/data/product-cutouts.data.js";
import { cutoutFor, squarePhotoId } from "../src/data/product-cutouts.js";
import { buildGuideDraft, idMaker, productPhoto } from "../src/admin/guides/build.js";
import { cleanDocument } from "../src/admin/guides/model.js";
import { FONT_CSS, guideElementHtml } from "../src/admin/guides/render.js";
import { addProductToGuide } from "../src/admin/guides/products.js";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

const cutId = Object.keys(CUTOUTS)[0];
const square = (id) => `https://items-images-production.s3.us-west-2.amazonaws.com/files/${id}/original.jpeg`;
const missing = "0123456789abcdef0123456789abcdef01234567";

// --- the list of cut-outs -------------------------------------------------------
{
  const dir = new URL("../public/media/products/cutouts/", import.meta.url);
  check("there are cut-outs to use", Object.keys(CUTOUTS).length > 0, true);
  check("every listed cut-out has its file", Object.keys(CUTOUTS).filter((id) => !existsSync(new URL(`${id}.webp`, dir))), []);
  check("every cut-out file is listed (none left behind)", readdirSync(dir).filter((file) => !CUTOUTS[file.replace(/\.webp$/, "")]), []);
  check("the Square photo id is read from its URL", squarePhotoId(square(cutId)), cutId);
  check("other addresses have no Square photo id", [squarePhotoId("https://evil.test/files/" + cutId + "/x.png"), squarePhotoId("/media/x.png"), squarePhotoId(null)], [null, null, null]);
  check("a photo with a cut-out gets it", cutoutFor(square(cutId)), `/media/products/cutouts/${cutId}.webp`);
  check("a photo without one keeps the original", cutoutFor(square(missing)), null);
  check("an inherited name is not a cut-out", cutoutFor(square("constructor".padEnd(20, "0"))), null);
}

// --- in a guide ------------------------------------------------------------------
{
  const id = idMaker();
  const cut = productPhoto(id, { name: "Cut", key: "a", image: square(cutId) });
  check("a product with a cut-out shows it with a shadow", [cut.src, cut.style], [`/media/products/cutouts/${cutId}.webp`, { shadow: true }]);
  const plain = productPhoto(id, { name: "Plain", key: "b", image: square(missing) });
  check("a product without one shows its Square photo, no shadow", [plain.src, plain.style], [square(missing), {}]);
  check("the shadow survives a save", cleanDocument({ pages: [{ id: "p", kind: "blank", elements: [cut] }] }).pages[0].elements[0].style, { shadow: true });
  check("the shadow is drawn around the photo's outline", guideElementHtml(cut, FONT_CSS).includes("filter:drop-shadow("), true);
  check("photos without it have no shadow", guideElementHtml(plain, FONT_CSS).includes("drop-shadow"), false);

  const items = [{ name: "Dermathod Moist Morning Touch Foam Cleanser", slug: "d", image: square(cutId), step: "cleanse" }];
  const draft = buildGuideDraft({ clientName: "Sofia", routine: { items } });
  const photos = draft.pages.flatMap((page) => page.elements).filter((element) => element.role === "product-photo");
  check("a new draft uses the cut-out on every page", [photos.length > 1, photos.every((photo) => photo.src.endsWith(".webp") && photo.style.shadow)], [true, true]);
  const friend = buildGuideDraft({ clientName: "Mo", routine: null });
  addProductToGuide(friend, items[0]);
  const added = friend.pages.flatMap((page) => page.elements).filter((element) => element.role === "product-photo");
  check("+ Product uses the cut-out too", [added.length > 0, added.every((photo) => photo.src.endsWith(".webp") && photo.style.shadow)], [true, true]);
}

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll product cut-out checks passed");
