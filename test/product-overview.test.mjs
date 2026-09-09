import assert from "node:assert/strict";
import { structureProductOverview, renderProductOverview } from "../src/product-overview.js";
import { productPage } from "../src/pages/product.js";
import { toString } from "../src/html.js";
import { STYLES } from "../src/styles.js";

const richProduct = {
  name: "KrX Neck Lift Intensive Firming Neck Cream",
  description: "KrX Neck Lift Intensive Firming Neck Cream is a revolutionary solution. Key Benefits: Lifts and Firms: Supports a smoother appearance. Pro Tip: Apply to other areas with crepey-looking skin. Best Suited For: Aging, dehydrated skin. Caution: Avoid use if allergic to almond oil.",
  descriptionHtml: `
    <p><strong>KrX Neck Lift Intensive Firming Neck Cream</strong> is a revolutionary solution for the delicate skin of the neck and décolletage.</p>
    <p>Backed by science, this cream targets firmness, elasticity, and hydration.</p>
    <p><strong>Key Benefits:</strong></p>
    <ul>
      <li><strong>Lifts and Firms:</strong> Supports a smoother, more lifted appearance.</li>
      <li><strong>Deep Hydration:</strong> Helps replenish and lock in moisture.</li>
    </ul>
    <p><strong>Pro Tip:</strong> Apply to other areas with crepey-looking skin.</p>
    <p><strong>Best Suited For:</strong> Aging, dehydrated skin.</p>
    <p><strong>Caution:</strong> Avoid use if allergic to almond oil.</p>
  `,
};

const model = structureProductOverview(richProduct);
assert.equal(model.intro.length, 2, "Square paragraphs remain separate");
assert.deepEqual(model.sections.map((section) => section.key), ["benefits", "tip", "best-for", "caution"], "authored labels become meaningful sections");
assert.equal(model.sections[0].content.length, 2, "benefits remain a list");
assert.equal(model.hasUsage, false, "usage is not invented when Square did not provide it");

const rendered = toString(renderProductOverview(richProduct).markup);
assert.match(rendered, /<strong>KrX Neck Lift Intensive Firming Neck Cream<\/strong>/, "the opening product name is emphasized");
assert.match(rendered, /<details class="product-overview-section product-overview-benefits[\s\S]*<span>Key benefits<\/span>[\s\S]*<ul>/, "benefits render as an expandable readable list");
assert.match(rendered, /<strong>Lifts and Firms:<\/strong>/, "benefit labels are emphasized");
assert.match(rendered, /product-overview-tip/, "professional tips use a compact callout");
assert.equal((rendered.match(/<details class="product-overview-section/g) || []).length, 4, "authored overview sections are expandable");
assert.match(STYLES, /\.product-description \{[^}]*display: block;/, "closed overview rows do not inherit a stretching grid layout");
assert.match(STYLES, /\.product-overview-section summary \{[^}]*padding: 19px 0;/, "overview rows use the same compact padding as the standard product accordions");
assert.match(STYLES, /\.product-overview-section:last-child \{ border-bottom: 0; \}/, "the overview and shipping accordions share one divider instead of a double line");

const squareBulletHeadings = structureProductOverview({
  descriptionHtml: "<p><strong>Key Benefits:</strong></p><ul><li>Brightens visible discoloration.</li><li>Perfect For:</li><li>Uneven-looking tone</li><li>Dark spots</li><li><strong>Note:</strong> Avoid if allergic to apple or papaya.</li></ul>",
});
assert.deepEqual(squareBulletHeadings.sections.map((section) => section.key), ["benefits", "best-for", "caution"], "bullet-formatted Perfect For and Note labels become separate sections");
assert.deepEqual(squareBulletHeadings.sections[1].content, ["Uneven-looking tone", "Dark spots"], "Perfect For owns only its intended list items");

const simple = structureProductOverview({ description: "A gentle cleanser that removes daily buildup without leaving skin tight." });
assert.equal(simple.intro.length, 1, "short copy stays a simple paragraph");
assert.equal(simple.sections.length, 0, "short copy does not gain empty sections");

const unlabeledBullets = structureProductOverview({ descriptionHtml: "<p>A daily moisturizer.</p><ul><li>Lightweight finish</li><li>Layers under sunscreen</li></ul>" });
assert.equal(unlabeledBullets.sections[0].key, "points", "authored bullets remain a list without inventing a heading");
assert.equal(unlabeledBullets.sections[0].title, "", "unlabeled Square bullets do not receive an invented section title");

const long = structureProductOverview({
  description: "First sentence explains the product. Second sentence adds context. Third sentence explains another benefit. Fourth sentence completes the description with helpful detail for the customer and makes this text long enough to require a more readable treatment rather than one dense paragraph on the page.".repeat(2),
});
assert.ok(long.intro.length > 1, "long flat Square copy is split into readable paragraphs");

const unsafe = toString(renderProductOverview({ descriptionHtml: "<p>Safe copy</p><script>alert('x')</script><p><img src=x onerror=alert(1)>More copy</p>" }).markup);
assert.doesNotMatch(unsafe, /<script|onerror|<img/i, "untrusted Square HTML is never injected into the page");
assert.match(unsafe, /Safe copy/, "safe description text remains available");

const product = {
  name: "Daily Serum",
  category: "Serums",
  description: "A lightweight serum. How to use: Apply one pump after cleansing.",
  image: null,
  priceCents: 4200,
  available: true,
  variations: [{ id: "VAR", name: "1 oz", priceCents: 4200, inStock: true }],
  defaultVariation: { id: "VAR", name: "1 oz", priceCents: 4200, inStock: true },
};
const cfg = { shippingEnabled: true, pickupEnabled: true, shippingFeeCents: 1000, freeShippingThresholdCents: 20000 };
const page = toString(productPage({ product, related: [], cfg }));
assert.ok(page.indexOf("data-price-display") < page.indexOf("class=\"product-buy\""), "purchase controls follow the price");
assert.ok(page.indexOf("class=\"product-buy\"") < page.indexOf("class=\"product-description\""), "purchase controls appear before a long overview");
assert.equal((page.match(/>How to use</g) || []).length, 1, "Square usage directions replace the generic usage accordion instead of repeating it");
assert.match(page, /Apply one pump after cleansing/, "Square directions remain unchanged");

const choiceProduct = {
  ...product,
  variations: [
    product.variations[0],
    { id: "VAR_LARGE", name: "2 oz", priceCents: 6800, inStock: true },
  ],
};
const choicePage = toString(productPage({ product: choiceProduct, related: [], cfg }));
assert.ok(choicePage.indexOf("class=\"variation-picker\"") < choicePage.indexOf("class=\"product-buy\""), "products with options ask for a selection before Add to bag");

const faqProduct = { ...product, description: "A daily serum. FAQ: Can I use it daily? Yes, as directed." };
const faqPage = toString(productPage({ product: faqProduct, related: [], cfg }));
assert.equal((faqPage.match(/>Common questions</g) || []).length, 1, "an authored FAQ becomes the only questions section");
assert.doesNotMatch(faqPage, /Book a consult and Laura/, "an authored FAQ suppresses the generic questions accordion");

console.log("PASS  Square descriptions become safe, structured, non-repetitive product overviews");
