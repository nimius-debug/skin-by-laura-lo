import { resolveRoutine, bundleDiscountCents } from "../src/routines.js";

function product(slug, priceCents, inStock = true) {
  return { slug, defaultVariation: { id: "VAR_" + slug, priceCents, inStock } };
}

const PRODUCTS = [
  product("cleanser", 3000),
  product("serum", 7000),
  product("cream", 4000),
  product("spf", 2500, false), // sold out
];

const ROUTINE = {
  slug: "test-routine",
  name: "Test Routine",
  discount: 5000,
  products: [
    { slug: "cleanser", role: "" },
    { slug: "serum", role: "" },
    { slug: "cream", role: "" },
    { slug: "spf", role: "" },
  ],
};

const OTHER_ROUTINE = {
  slug: "other-routine",
  name: "Other Routine",
  discount: 2000,
  products: [{ slug: "cleanser", role: "" }],
};

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

// --- resolveRoutine exposes a discounted total, sold-out items excluded from both
const resolved = resolveRoutine(ROUTINE, PRODUCTS);
check("totalCents sums only in-stock items", resolved.totalCents, 3000 + 7000 + 4000);
check("discountedTotalCents subtracts the discount", resolved.discountedTotalCents, 3000 + 7000 + 4000 - 5000);

// --- discount never goes negative
const cheapResolved = resolveRoutine({ ...ROUTINE, discount: 999999 }, PRODUCTS);
check("discountedTotalCents floors at 0", cheapResolved.discountedTotalCents, 0);

// --- bundleDiscountCents: the real, server-side check
const fullCart = ["VAR_cleanser", "VAR_serum", "VAR_cream"]; // spf is sold out, so not required
check("full bundle (sold-out item excluded) earns the discount",
  bundleDiscountCents(fullCart, PRODUCTS, [ROUTINE]), 5000);

const partialCart = ["VAR_cleanser", "VAR_serum"]; // missing cream
check("partial cart earns no discount",
  bundleDiscountCents(partialCart, PRODUCTS, [ROUTINE]), 0);

const extraItemsCart = ["VAR_cleanser", "VAR_serum", "VAR_cream", "VAR_unrelated"];
check("extra unrelated items don't block the discount",
  bundleDiscountCents(extraItemsCart, PRODUCTS, [ROUTINE]), 5000);

check("routine with discount: null never contributes",
  bundleDiscountCents(fullCart, PRODUCTS, [{ ...ROUTINE, discount: null }]), 0);

// --- multiple matched routines stack (caller is responsible for clamping to subtotal)
const bothCart = ["VAR_cleanser", "VAR_serum", "VAR_cream"];
check("discounts from multiple fully-matched routines sum",
  bundleDiscountCents(bothCart, PRODUCTS, [ROUTINE, OTHER_ROUTINE]), 5000 + 2000);

console.log(failures === 0 ? "\nAll routines tests passed." : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
