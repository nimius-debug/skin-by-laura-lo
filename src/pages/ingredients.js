import { html, jsonScript, raw } from "../html.js";
import { productCard } from "./components.js";
import { BOOKING_URL, priceMarkup } from "../config.js";
import { PORE_CLOGGERS } from "../data/pore-cloggers.js";
import {
  GROUPS, MAX_LIST_CHARS, PRODUCT_TYPES, productTypeLabel, researchUrl, ingredientSlug,
} from "../ingredient-checker.js";

const CLOGGER_SLUGS = new Set(PORE_CLOGGERS.map((item) => ingredientSlug(item.name)));

/** Whether an ingredient has its own page: it is in a shop formula, or on the pore-clogging list. */
export function hasIngredientPage(slug, shopIndex) {
  return shopIndex.ingredients.has(slug) || CLOGGER_SLUGS.has(slug);
}

function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

function nameList(items) {
  const names = items.map((item) => item.name);
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function typeOptions(selected) {
  return html`
    <option value="">Not sure</option>
    ${PRODUCT_TYPES.map((type) => html`<option value="${type.id}" ${type.id === selected ? html`selected` : ""}>${type.label}</option>`)}
  `;
}

function checkerForms({ tab, list, type, query, suggestions }) {
  const pasteTab = tab !== "product";
  return html`
    <div class="checker-tabs" role="tablist" aria-label="How to check">
      <a role="tab" href="/ingredients" aria-selected="${pasteTab ? "true" : "false"}" class="${pasteTab ? "active" : ""}">Paste an ingredient list</a>
      <a role="tab" href="/ingredients?tab=product" aria-selected="${pasteTab ? "false" : "true"}" class="${pasteTab ? "" : "active"}">Find a product</a>
    </div>

    ${pasteTab ? html`
      <form class="checker-form" method="get" action="/ingredients#result" role="tabpanel">
        <label class="checker-label" for="checker-list">Paste the ingredient list here</label>
        <textarea id="checker-list" name="list" rows="6" maxlength="${MAX_LIST_CHARS}" required
          placeholder="Water, Glycerin, Niacinamide, …">${list}</textarea>
        <div class="checker-row">
          <div class="checker-type">
            <label class="checker-label" for="checker-type">What kind of product is it?</label>
            <select id="checker-type" name="type">${typeOptions(type)}</select>
          </div>
          <div class="checker-actions">
            <button class="button button-dark" type="submit">Check</button>
            <a class="button button-light" href="/ingredients">Clear</a>
          </div>
        </div>
        <p class="checker-hint">Copy the list from the box or the brand&#8217;s website. Nothing you paste is saved.</p>
      </form>
    ` : html`
      <form class="checker-form" method="get" action="/ingredients#result" role="tabpanel">
        <input type="hidden" name="tab" value="product" />
        <label class="checker-label" for="checker-product">Search Laura&#8217;s shop</label>
        <div class="checker-row">
          <div class="checker-combo">
            <input id="checker-product" name="q" type="search" value="${query}" data-checker-search
              role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="checker-suggest"
              placeholder="e.g. Corthe toner" autocomplete="off" required />
            <div id="checker-suggest" class="checker-suggest" role="listbox" aria-label="Matching products" data-checker-suggest hidden></div>
          </div>
          <div class="checker-actions">
            <button class="button button-dark" type="submit">Check</button>
          </div>
        </div>
        <script type="application/json" data-checker-products>${jsonScript(suggestions)}</script>
        <p class="checker-hint">Checking something from another brand? <a href="/ingredients">Paste its ingredient list</a> instead.</p>
      </form>
    `}
  `;
}

function ingredientRow(item, shopIndex) {
  const linked = hasIngredientPage(item.slug, shopIndex);
  return html`
    <details class="checker-ingredient checker-ingredient-${item.group}">
      <summary>
        <span class="checker-dot" aria-hidden="true"></span>
        <span class="checker-ingredient-name">${item.name}</span>
        <span class="checker-ingredient-role">${item.role}</span>
        <span class="checker-tag">${item.tag}</span>
      </summary>
      <div class="checker-explanation">
        <div>
          <p class="ingredient-label">What it is</p>
          <p>${item.description}</p>
        </div>
        <div>
          <p class="ingredient-label">${item.clogger ? "Why it can clog pores" : "Why it’s used"}</p>
          <p>${item.clogger ? item.clogger.why : item.why}</p>
        </div>
        <div>
          <p class="ingredient-label">Good to know</p>
          <p>${item.note}</p>
          <p class="ingredient-evidence">Information level: <strong>${item.level}</strong></p>
          ${linked ? html`<a class="text-link" href="/ingredients/${item.slug}">Read more about ${item.name}</a>` : ""}
        </div>
      </div>
    </details>
  `;
}

function verdict(result) {
  if (!result.ingredients.length) {
    return html`
      <div class="checker-verdict">
        <div>
          <p class="checker-verdict-eyebrow">Result</p>
          <h2 id="result-heading">We couldn&#8217;t read any ingredients</h2>
          <p>Paste the list with commas between ingredients, the way it&#8217;s printed on the box.</p>
        </div>
      </div>
    `;
  }
  const clogCount = result.cloggers.length;
  return html`
    <div class="checker-verdict ${clogCount ? "checker-verdict-clog" : "checker-verdict-safe"}">
      <div>
        <p class="checker-verdict-eyebrow">Result</p>
        <h2 id="result-heading">${clogCount
          ? `${plural(clogCount, "pore-clogging ingredient")} found`
          : "No known pore-cloggers found"}</h2>
        <p>${clogCount
          ? `${nameList(result.cloggers)} ${clogCount === 1 ? "is" : "are"} on Laura’s pore-clogging list. If you break out easily, this product is not acne-safe.`
          : "None of these ingredients are on Laura’s pore-clogging list, so this product looks acne-safe."}</p>
      </div>
      <dl class="checker-counts">
        <div><dt>ingredients read</dt><dd>${result.ingredients.length}</dd></div>
        <div class="checker-count-clog"><dt>pore-clogging</dt><dd>${clogCount}</dd></div>
        <div><dt>skin helpers</dt><dd>${result.helpers.length}</dd></div>
        <div class="checker-count-note"><dt>worth knowing</dt><dd>${result.notes.length}</dd></div>
      </dl>
    </div>

    <div class="checker-explainers">
      <div>
        <p class="ingredient-label">What it means</p>
        <p>A pore-clogging (comedogenic) ingredient tends to block pores in acne-prone skin, which can lead to blackheads, whiteheads and breakouts.</p>
      </div>
      <div>
        <p class="ingredient-label">Why it matters</p>
        <p>Breakouts can take weeks to show up after you start a product, so one ingredient can quietly undo an acne routine.</p>
      </div>
      <div>
        <p class="ingredient-label">Keep in mind</p>
        <p>Labels don&#8217;t show how much of each ingredient is used. Not sure? Bring the product to your appointment.</p>
      </div>
    </div>
  `;
}

function groups(result) {
  const list = [
    ["clog", result.cloggers],
    ["note", result.notes],
    ["help", result.helpers],
    ["base", result.basics],
  ].filter(([, items]) => items.length);
  return html`
    <section class="checker-section" aria-labelledby="checker-groups">
      <p class="eyebrow">At a glance</p>
      <h2 id="checker-groups">Ingredients by what they do</h2>
      <div class="checker-groups">
        ${list.map(([group, items]) => html`
          <div class="checker-group checker-group-${group}">
            <p class="checker-group-label">${GROUPS[group].label}</p>
            <p>${items.map((item) => item.name).join(", ")}</p>
          </div>
        `)}
      </div>
    </section>
  `;
}

function alternativesSection({ result, alternatives, type, list, typeNeeded }) {
  if (typeNeeded) {
    return html`
      <section class="checker-section checker-alternatives" aria-labelledby="checker-alts">
        <p class="eyebrow">From Laura&#8217;s shop</p>
        <h2 id="checker-alts">Want a better alternative?</h2>
        <form class="checker-type-prompt" method="get" action="/ingredients#alternatives">
          <input type="hidden" name="list" value="${list}" />
          <label class="checker-label" for="checker-type-again">Tell us what kind of product this is and we&#8217;ll look for a similar one without ${result.cloggers.length ? "the pore-cloggers" : "fragrance"}.</label>
          <div class="checker-row">
            <select id="checker-type-again" name="type">${typeOptions(type)}</select>
            <button class="button button-dark" type="submit">Find alternatives</button>
          </div>
        </form>
      </section>
    `;
  }
  if (!alternatives.length) return "";
  return html`
    <section class="checker-section checker-alternatives" id="alternatives" aria-labelledby="checker-alts">
      <div class="checker-section-head">
        <div>
          <p class="eyebrow">From Laura&#8217;s shop</p>
          <h2 id="checker-alts">Better alternatives</h2>
          <p>${productTypeLabel(type)} picks from Laura&#8217;s shop with the same skin helpers as this list, without ${result.cloggers.length ? "the pore-cloggers" : "the fragrance"}.</p>
        </div>
      </div>
      <div class="product-grid checker-alt-grid">
        ${alternatives.map((match) => html`
          <div class="checker-alt">
            ${productCard(match.product, { showAdd: true })}
            <div class="checker-alt-why">
              <p><strong>Also has:</strong> ${match.shared.slice(0, 4).map((item) => item.name).join(", ")}${match.shared.length > 4 ? ` and ${match.shared.length - 4} more` : ""}</p>
              <p class="checker-alt-better">${match.reasons.join(" · ")}</p>
            </div>
          </div>
        `)}
      </div>
      <p class="checker-hint">Only products of the same kind that share this list&#8217;s skin helpers and have none of its flagged ingredients are suggested.</p>
    </section>
  `;
}

function checkedProductPanel(product, type, result) {
  return html`
    <div class="checker-picked-bar">
      <p>Checking a product from Laura&#8217;s shop</p>
      <a class="text-link" href="/ingredients?tab=product">Check a different product</a>
    </div>
    <div class="checker-picked">
      <a class="checker-picked-product" href="/product/${product.slug}">
        ${product.image
          ? html`<img src="${product.image}" alt="${product.name}" width="300" height="350" />`
          : html`<span class="product-image-fallback">${product.name}</span>`}
        ${type ? html`<span class="checker-picked-kind">${productTypeLabel(type)}</span>` : ""}
        <span class="checker-picked-name">${product.name}</span>
        <span class="checker-picked-price">${raw(priceMarkup(product.priceCents, product.regularPriceCents))}</span>
        <span class="text-link">View product page</span>
      </a>
      <div class="checker-picked-result">${verdict(result)}</div>
    </div>
  `;
}

function results({ result, checkedName, checkedProduct, alternatives, type, list, typeNeeded, shopIndex }) {
  return html`
    <div class="checker-results section-shell" id="result">
      <section class="checker-section" aria-labelledby="result-heading">
        ${checkedProduct
          ? checkedProductPanel(checkedProduct, type, result)
          : html`${checkedName ? html`<p class="checker-checking">Checking <strong>${checkedName}</strong></p>` : ""}${verdict(result)}`}
      </section>
      ${result.ingredients.length ? html`
        ${groups(result)}
        <section class="checker-section" aria-labelledby="checker-all">
          <p class="eyebrow">Tap any ingredient to learn more</p>
          <h2 id="checker-all">Every ingredient, in label order</h2>
          <div class="checker-list">
            ${result.ingredients.map((item) => ingredientRow(item, shopIndex))}
          </div>
        </section>
        ${alternativesSection({ result, alternatives, type, list, typeNeeded })}
      ` : ""}
    </div>
  `;
}

function productMatches({ query, matches }) {
  return html`
    <div class="checker-results section-shell" id="result">
      <section class="checker-section">
        ${matches.length ? html`
          <h2>Pick a product</h2>
          <ul class="checker-matches">
            ${matches.map((product) => html`<li><a href="/ingredients?tab=product&amp;product=${product.slug}#result">${product.name}</a></li>`)}
          </ul>
        ` : html`
          <h2>&#8220;${query}&#8221; isn&#8217;t in Laura&#8217;s shop</h2>
          <p>Paste its ingredient list instead and we&#8217;ll check every ingredient.</p>
          <a class="text-link" href="/ingredients">Paste an ingredient list</a>
        `}
      </section>
    </div>
  `;
}

/** The checker page: the forms, and the result when there is one. */
export function checkerPage({
  tab = "", list = "", type = "", query = "", suggestions = [], checked = null, matches = null, shopIndex,
}) {
  return html`
    <div class="checker-page">
      <div class="checker-hero section-shell">
        <div>
          <p class="eyebrow">Ingredient checker</p>
          <h1>What&#8217;s <em>really</em> in your skincare</h1>
        </div>
        <p>Paste any ingredient list, or pick a product, and see which ingredients can clog pores, what each one does for your skin, and the research behind it.</p>
      </div>

      <div class="checker-input section-shell">
        ${checkerForms({ tab, list, type, query, suggestions })}
      </div>

      ${checked ? results({ ...checked, list, shopIndex }) : matches ? productMatches({ query, matches }) : ""}

      <p class="checker-disclaimer section-shell">
        This checker reads ingredient names only and is a starting point, not medical advice. It doesn&#8217;t know amounts,
        and everyone&#8217;s skin is different. For a plan made for your skin,
        <a href="${BOOKING_URL}">book a consultation with Laura</a>.
      </p>
    </div>
  `;
}

function quickCheck(label, value) {
  return html`<div><dt>${label}</dt><dd>${value}</dd></div>`;
}

/** A page for one ingredient: what it does, whether it clogs pores, research, and the shop products that contain it. */
export function ingredientPage({ entry }) {
  const uses = entry.products || [];
  const exfoliating = /exfoliat/i.test(entry.role);
  const fragrance = /fragrance|sensory/i.test(entry.role);
  return html`
    <div class="checker-page ingredient-page">
      <nav class="breadcrumbs section-shell" aria-label="Breadcrumb">
        <a href="/ingredients">Ingredient checker</a> <span aria-hidden="true">/</span> <span>${entry.name}</span>
      </nav>

      <div class="checker-hero ingredient-hero section-shell">
        <div>
          <p class="eyebrow">${entry.role}</p>
          <h1>${entry.name}</h1>
          <div class="ingredient-badges">
            <span class="checker-tag checker-tag-${entry.group}">${entry.tag}</span>
            ${entry.clogger ? "" : html`<span class="checker-tag checker-tag-help">Not on the pore-clogging list</span>`}
            <span class="checker-tag checker-tag-base">Information level: ${entry.level}</span>
          </div>
        </div>
      </div>

      <section class="checker-explainers ingredient-facts section-shell">
        <div>
          <p class="ingredient-label">What it is</p>
          <p>${entry.description}</p>
        </div>
        <div>
          <p class="ingredient-label">${entry.clogger ? "Why it can clog pores" : "How it helps your skin"}</p>
          <p>${entry.clogger ? entry.clogger.why : entry.why}</p>
        </div>
        <div>
          <p class="ingredient-label">Good to know</p>
          <p>${entry.note}</p>
        </div>
      </section>

      <section class="checker-section section-shell" aria-labelledby="ingredient-checks">
        <h2 id="ingredient-checks">Quick checks</h2>
        <dl class="checker-counts ingredient-checks">
          ${quickCheck("Pore-clogging", entry.clogger ? "Yes" : "No")}
          ${quickCheck("Fragrance or scent", fragrance ? "Yes" : "No")}
          ${quickCheck("Exfoliating", exfoliating ? "Yes" : "No")}
        </dl>
      </section>

      <section class="checker-section section-shell" aria-labelledby="ingredient-research">
        <h2 id="ingredient-research">The research</h2>
        <p class="checker-hint">Published studies on ${entry.name} and skin, from PubMed, the US National Library of Medicine&#8217;s research index.</p>
        <a class="text-link" href="${researchUrl(entry.name)}" target="_blank" rel="noopener noreferrer">Search studies on PubMed <span aria-hidden="true">&#8599;</span></a>
      </section>

      ${uses.length ? html`
        <section class="checker-section section-shell" aria-labelledby="ingredient-shop">
          <h2 id="ingredient-shop">In Laura&#8217;s shop</h2>
          <div class="product-grid checker-alt-grid">
            ${uses.slice(0, 12).map((use) => html`
              <div class="checker-alt">
                ${productCard(use.product, { showAdd: true })}
                <p class="checker-hint">Listed ${ordinal(use.position)} of ${use.total}</p>
              </div>
            `)}
          </div>
        </section>
      ` : ""}

      <div class="section-shell checker-back">
        <a class="text-link" href="/ingredients">Check another product</a>
      </div>
    </div>
  `;
}
