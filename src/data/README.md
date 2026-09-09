# Product formula content

Square remains the source of truth for products, prices, inventory, variations, and checkout. This directory stores only the editorial formula research displayed alongside those products.

`product-formulas.js` contains one record for each reviewed Square catalogue item:

- `name`: the current Square product name used for lookup
- `formula`: the published INCI text, preserved in label order
- `source`: where the formula was obtained
- `confidence`: whether the formula is official, published, partial, or still needs verification
- `summary`, `considerations`, and `bestFor`: product-level formula interpretation
- `reviewed`: the date the source was last reviewed

Reusable ingredient explanations live in `../ingredient-library.js`. Product records do not duplicate those descriptions.

## Updating a formula

1. Confirm the current package panel or an official manufacturer ingredient list.
2. Preserve the ingredient order exactly as published.
3. Update the source, confidence label, and reviewed date.
4. Add a specific ingredient profile only when the shared library does not describe the ingredient accurately.
5. Run `npm test` before publishing.

Do not convert incomplete marketing disclosures into a full formula. Partial and unverified records deliberately render a visible status message on the product page.
