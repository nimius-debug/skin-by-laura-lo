import { html } from "./html.js";

const SECTION_DEFINITIONS = [
  { key: "benefits", title: "Key benefits", labels: ["key benefits", "benefits", "key features", "why you’ll love it", "why you'll love it"] },
  { key: "usage", title: "How to use", labels: ["how to use", "how to apply", "directions", "application", "usage"] },
  { key: "tip", title: "Laura’s tip", labels: ["pro tip", "professional tip", "laura’s tip", "laura's tip", "expert tip"] },
  { key: "best-for", title: "Perfect for", labels: ["perfect for", "best suited for", "best for", "ideal for", "recommended for", "skin type", "who it’s for", "who it's for"] },
  { key: "caution", title: "Good to know", labels: ["note", "important", "caution", "cautions", "warning", "warnings", "please note", "contraindications"] },
  { key: "questions", title: "Common questions", labels: ["common questions", "frequently asked questions", "faq"] },
];

const SECTION_BY_LABEL = new Map(
  SECTION_DEFINITIONS.flatMap((section) => section.labels.map((label) => [label, section])),
);

const LABEL_PATTERN = SECTION_DEFINITIONS
  .flatMap((section) => section.labels)
  .sort((a, b) => b.length - a.length)
  .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function richDescriptionToBlocks(value) {
  return decodeEntities(
    String(value || "")
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<li\b[^>]*>/gi, "\n• ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|h[1-6]|li|ul|ol)>/gi, "\n")
      .replace(/<(p|div|section|article|h[1-6]|ul|ol)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

function prepareSource(description, descriptionHtml) {
  const rich = String(descriptionHtml || "").trim();
  let source = rich ? richDescriptionToBlocks(rich) : String(description || "");

  // Square's plain-text field sometimes flattens headings onto the preceding
  // paragraph. Restore only labels that were actually present in that copy.
  source = source.replace(new RegExp(`\\s+(${LABEL_PATTERN})\\s*:`, "gi"), "\n$1:");
  source = source.replace(/\r/g, "");

  const blocks = [];
  for (const rawLine of source.split(/\n+/)) {
    const line = rawLine.replace(/[\t ]+/g, " ").trim();
    if (!line) continue;

    const bulletParts = line.split(/\s*[•▪◦]\s*/).filter(Boolean);
    if (/^[•▪◦]/.test(line) && bulletParts.length) {
      blocks.push(...bulletParts.map((part) => `• ${part.trim()}`));
    } else {
      blocks.push(line);
    }
  }
  return blocks;
}

function sectionAtStart(value) {
  // Square sometimes represents a section label as the first item in the
  // preceding list (for example, "• Perfect For:"). Treat the label as a
  // heading and let the following list items belong to that new section.
  const candidate = cleanItem(value);
  const normalized = candidate.toLowerCase().replace(/[’]/g, "'").trim();
  for (const [label, section] of SECTION_BY_LABEL) {
    const normalizedLabel = label.replace(/[’]/g, "'");
    if (normalized === normalizedLabel || normalized === `${normalizedLabel}:`) {
      return { section, content: "" };
    }
    if (normalized.startsWith(`${normalizedLabel}:`)) {
      return { section, content: candidate.slice(candidate.indexOf(":") + 1).trim() };
    }
  }
  return null;
}

function sentences(value) {
  return value.match(/[^.!?]+(?:[.!?]+[”’"']?|$)/g)?.map((part) => part.trim()).filter(Boolean) || [value];
}

function readableParagraphs(blocks) {
  const paragraphs = [];
  for (const block of blocks) {
    if (block.length < 300) {
      paragraphs.push(block);
      continue;
    }

    const parts = sentences(block);
    if (parts.length < 3) {
      paragraphs.push(block);
      continue;
    }

    for (let index = 0; index < parts.length; index += 2) {
      paragraphs.push(parts.slice(index, index + 2).join(" "));
    }
  }
  return paragraphs;
}

function cleanItem(value) {
  return value.replace(/^(?:[•▪◦]|[-–—]\s+)/, "").trim();
}

function unique(values, seen) {
  return values.filter((value) => {
    const key = cleanItem(value).toLowerCase().replace(/\s+/g, " ").replace(/[.!]+$/, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Turn Square's description into a small, safe presentation model. The copy is
 * never rewritten or supplemented; headings merely expose organization that is
 * already present in the merchant-authored description.
 */
export function structureProductOverview({ description = "", descriptionHtml = "" } = {}) {
  const blocks = prepareSource(description, descriptionHtml);
  const intro = [];
  const sections = [];
  let current = null;

  for (const block of blocks) {
    const match = sectionAtStart(block);
    if (match) {
      current = sections.find((section) => section.key === match.section.key);
      if (!current) {
        current = { key: match.section.key, title: match.section.title, content: [] };
        sections.push(current);
      }
      if (match.content) current.content.push(match.content);
      continue;
    }

    if (!current && /^[•▪◦]|^[-–—]\s+/.test(block)) {
      let points = sections.find((section) => section.key === "points");
      if (!points) {
        points = { key: "points", title: "", content: [] };
        sections.push(points);
      }
      points.content.push(block);
      continue;
    }

    if (current) current.content.push(block);
    else intro.push(block);
  }

  const seen = new Set();
  const normalizedIntro = unique(readableParagraphs(intro), seen);
  const normalizedSections = sections
    .map((section) => ({
      ...section,
      content: unique(section.content.map(cleanItem), seen),
      list: section.key === "benefits" || section.key === "points" || section.content.some((item) => /^[•▪◦]|^[-–—]\s+/.test(item)),
    }))
    .filter((section) => section.content.length);

  return {
    intro: normalizedIntro,
    sections: normalizedSections,
    hasUsage: normalizedSections.some((section) => section.key === "usage"),
    hasQuestions: normalizedSections.some((section) => section.key === "questions"),
    empty: normalizedIntro.length === 0 && normalizedSections.length === 0,
  };
}

function emphasizedLine(value) {
  const match = value.match(/^([^:]{2,55}:)\s+(.+)$/);
  return match ? html`<strong>${match[1]}</strong> ${match[2]}` : value;
}

function paragraph(value, productName, opening = false) {
  if (opening && productName && value.toLowerCase().startsWith(productName.toLowerCase())) {
    return html`<p><strong>${value.slice(0, productName.length)}</strong>${value.slice(productName.length)}</p>`;
  }
  return html`<p>${emphasizedLine(value)}</p>`;
}

function overviewSection(section) {
  if (!section.title) {
    return html`
      <section class="product-overview-section product-overview-points">
        <ul>${section.content.map((item) => html`<li>${emphasizedLine(item)}</li>`)}</ul>
      </section>
    `;
  }

  const isCallout = ["tip", "caution"].includes(section.key);
  return html`
    <details class="product-overview-section product-overview-${section.key} ${isCallout ? "product-overview-callout" : ""}">
      <summary>
        <span>${section.title}</span>
        <span class="product-overview-toggle" aria-hidden="true"></span>
      </summary>
      <div class="product-overview-section-body">
        ${section.list
          ? html`<ul>${section.content.map((item) => html`<li>${emphasizedLine(item)}</li>`)}</ul>`
          : section.content.map((item) => html`<p>${emphasizedLine(item)}</p>`)}
      </div>
    </details>
  `;
}

export function renderProductOverview(product) {
  const overview = structureProductOverview(product);
  if (overview.empty) {
    return {
      markup: html`<div class="product-description"><p>Ask Laura about this product at your next appointment &#8212; full details coming soon.</p></div>`,
      hasUsage: false,
      hasQuestions: false,
    };
  }

  return {
    markup: html`
      <div class="product-description">
        ${overview.intro.length
          ? html`<div class="product-overview-intro">${overview.intro.map((item, index) => paragraph(item, product.name, index === 0))}</div>`
          : ""}
        ${overview.sections.map(overviewSection)}
      </div>
    `,
    hasUsage: overview.hasUsage,
    hasQuestions: overview.hasQuestions,
  };
}
