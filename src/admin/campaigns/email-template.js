// The email as clients receive it. Built for inboxes, not browsers: tables,
// inline styles and web-safe fonts (email apps ignore web fonts and <style>
// rules more often than not), a hidden preview line, and a plain-text copy.
// Everything inserted is escaped: the words come from the AI or from Laura's
// edits and are never trusted as markup.

export const BUSINESS_ADDRESS = "307 S Boulevard Ste D, Tampa, FL 33606";

const COLORS = { ground: "#FBF6F0", ink: "#2A241F", soft: "#4A4038", muted: "#6E6358", line: "#E7DCCB", accent: "#B8714F", accentText: "#96583C", tint: "#F8EFE7" };
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Arial, Helvetica, sans-serif";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// A [named link](https://...) or a bare web address. One pattern, so a named
// link's address is never linked a second time.
const LINK = /\[([^\]<]+)\]\((https?:\/\/[^\s)<]+)\)|https?:\/\/[^\s<]+[^\s<.,;:!?)'"]/g;

/**
 * Escaped text with Laura's light formatting: line breaks kept, **bold**,
 * [named links](https://...) and bare web addresses made clickable. Nothing
 * else becomes markup.
 */
function rich(value) {
  return escapeHtml(value)
    .replace(/\r?\n/g, "<br>")
    .replace(/\*\*([^*<]+?)\*\*/g, "<strong>$1</strong>")
    .replace(LINK, (match, label, url) => `<a href="${url || match}" style="color:${COLORS.accentText};font-weight:bold;">${label || match}</a>`);
}

/** The plain-text copy of formatted text: no ** marks, and named links as "words (address)". */
export function plain(value) {
  return String(value ?? "")
    .replace(/\*\*([^*]+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)");
}

/** The shared email's product cards, including campaigns saved with a single card before there could be several. */
export function contentProducts(content) {
  if (Array.isArray(content?.products)) return content.products;
  return content?.product ? [content.product] : [];
}

/**
 * One product card, as a row of the email's product list. In the editor a shared
 * card gets a Remove button and a personal card's note can be typed into.
 */
export function productCardHtml(product, { removable = false, noteEdit = "" } = {}) {
  return `
              <tr${removable ? ` data-product="${escapeHtml(product.name)}"` : ""}><td style="padding:0 0 12px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COLORS.line};border-radius:14px;">
                  <tr>
                    ${product.image ? `<td width="88" valign="top" style="padding:14px 0 14px 14px;"><img src="${escapeHtml(product.image)}" width="72" height="72" alt="${escapeHtml(product.name)}" style="display:block;width:72px;height:72px;border-radius:10px;object-fit:cover;border:0;"></td>` : ""}
                    <td valign="top" style="padding:14px 16px;">
                      ${product.label ? `<div style="font-family:${SANS};font-size:11.5px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${COLORS.accentText};padding-bottom:4px;">${escapeHtml(product.label)}</div>` : ""}
                      <div style="font-family:${SANS};font-size:16px;line-height:1.35;font-weight:bold;color:${COLORS.ink};">${escapeHtml(product.name)}</div>
                      ${product.price ? `<div style="font-family:${SANS};font-size:15px;font-weight:bold;color:${COLORS.accentText};padding-top:2px;">${escapeHtml(product.price)}</div>` : ""}
                      ${product.goodFor ? `<div style="font-family:${SANS};font-size:14px;line-height:1.5;color:${COLORS.soft};padding-top:4px;">Good for: ${escapeHtml(product.goodFor)}</div>` : ""}
                      ${product.note || noteEdit ? `<div style="font-family:${SANS};font-size:14px;line-height:1.5;color:${COLORS.soft};padding-top:4px;"${noteEdit}>${rich(product.note || "")}</div>` : ""}
                      ${product.url ? `<div style="padding-top:8px;"><a href="${escapeHtml(product.url)}" style="font-family:${SANS};font-size:14px;font-weight:bold;color:${COLORS.accentText};">See it in the shop</a></div>` : ""}
                      ${removable ? `<div style="padding-top:10px;"><button type="button" data-remove-product style="font-family:${SANS};font-size:13px;font-weight:bold;color:${COLORS.muted};background:none;border:1px solid ${COLORS.line};border-radius:8px;padding:6px 10px;cursor:pointer;">Remove from email</button></div>` : ""}
                    </td>
                  </tr>
                </table>
              </td></tr>`;
}

const CALLS_TO_ACTION = {
  book: { label: "Book a facial", path: "/booking" },
  shop: { label: "Visit the shop", path: "/shop" },
  news: null,
};

/**
 * One finished email.
 *   content:  the shared email { subject, preheader, eyebrow, headline, paragraphs[], tips[] }
 *   content.ps: an optional P.S. everyone gets
 *   personal: { personalNote, ps } for a personal version, or null for the shared one
 *   products: the product cards, [{ label, name, price, goodFor, note, url, image }]
 *   editable: "shared" or "personal" for the admin editor only (never sent). It
 *             marks the parts of that version Laura can type into with
 *             data-edit, and shows empty ones so she can fill them in.
 * Returns { subject, html, text }.
 */
export function renderEmail({ content, personal = null, products = [], firstName = "", goal = "book", siteUrl, unsubscribeUrl, editable = null }) {
  const greetingName = firstName.trim() || "there";
  const cta = CALLS_TO_ACTION[goal] ? { ...CALLS_TO_ACTION[goal], url: `${siteUrl}${CALLS_TO_ACTION[goal].path}` } : null;
  const paragraphs = (content.paragraphs || []).filter(Boolean);
  const tips = (content.tips || []).filter(Boolean);
  const note = personal?.personalNote?.trim() || "";
  const postscripts = [content.ps, personal?.ps].map((ps) => String(ps || "").trim()).filter(Boolean);
  const editShared = editable === "shared";
  const editPersonal = editable === "personal";
  // Marks a part as editable in the admin editor; empty everywhere else.
  const edit = (on, name, placeholder) => (on ? ` data-edit="${name}" data-placeholder="${escapeHtml(placeholder)}"` : "");

  const p = (html) => `<p style="margin:0 0 18px;font-family:${SANS};font-size:16px;line-height:1.65;color:${COLORS.ink};">${html}</p>`;

  const noteBlock = note || editPersonal ? `
          <tr><td style="padding:0 0 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.tint};border-radius:12px;">
              <tr><td style="padding:18px 20px;">
                <div style="font-family:${SANS};font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${COLORS.accentText};padding-bottom:6px;">A note just for you</div>
                <div style="font-family:${SANS};font-size:15px;line-height:1.6;color:${COLORS.ink};"${edit(editPersonal, "personalNote", "Write a note just for this client")}>${rich(note)}</div>
              </td></tr>
            </table>
          </td></tr>` : "";

  const tipItem = `font-family:${SANS};font-size:15.5px;line-height:1.55;color:${COLORS.ink};padding:0 0 10px 4px;`;
  // While editing, the tips are one numbered list, so Enter adds a tip.
  const tipsBlock = editShared ? `
          <tr><td style="padding:4px 0 10px;">
            <div style="font-family:${SERIF};font-size:20px;font-weight:bold;color:${COLORS.ink};padding-bottom:10px;"${edit(true, "tipsTitle", "Tips title (leave the tips empty for none)")}>${escapeHtml(content.tipsTitle || "")}</div>
            <ol style="margin:0;padding:0 0 0 24px;"${edit(true, "tips", "Tips, one per line")}>${(tips.length ? tips : [""]).map((tip) => `<li style="${tipItem}">${rich(tip)}</li>`).join("")}</ol>
          </td></tr>` : tips.length ? `
          <tr><td style="padding:4px 0 10px;">
            <div style="font-family:${SERIF};font-size:20px;font-weight:bold;color:${COLORS.ink};padding-bottom:10px;">${escapeHtml(content.tipsTitle || "What helps")}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${tips.map((tip, index) => `<tr>
                <td width="34" valign="top" style="padding:0 0 12px;"><div style="width:24px;height:24px;line-height:24px;border-radius:12px;background:${COLORS.ink};color:${COLORS.ground};font-family:${SANS};font-size:13px;font-weight:bold;text-align:center;">${index + 1}</div></td>
                <td valign="top" style="padding:2px 0 12px;font-family:${SANS};font-size:15.5px;line-height:1.55;color:${COLORS.ink};">${rich(tip)}</td>
              </tr>`).join("")}
            </table>
          </td></tr>` : "";

  // While editing the shared email the section is always there (hidden when
  // empty), with a place for the editor to add products from the shop.
  const productsBlock = products.length || editShared ? `
          <tr${editShared ? ` data-products${products.length ? "" : ` style="display:none"`}` : ""}><td style="padding:8px 0 10px;">
            <div style="font-family:${SERIF};font-size:20px;font-weight:bold;color:${COLORS.ink};padding-bottom:12px;">From the shop</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" data-product-list>${products.map((product) => productCardHtml(product, {
              removable: editShared,
              noteEdit: editPersonal && product === personal?.product ? edit(true, "productNote", "Add a line about this product") : "",
            })).join("")}
            </table>
          </td></tr>` : "";

  const psRow = (ps, editing, name, placeholder) => (String(ps || "").trim() || editing
    ? `<tr><td style="padding:0 0 22px;font-family:${SANS};font-size:15px;line-height:1.6;color:${COLORS.soft};"><strong>P.S.</strong> <span${edit(editing, name, placeholder)}>${rich(String(ps || "").trim())}</span></td></tr>`
    : "");

  // While editing the shared email the button is always there (hidden for "no
  // button"), so the editor can switch it without reloading.
  const ctaBlock = cta || editShared ? `
          <tr${editShared ? ` data-cta${cta ? "" : ` style="display:none"`}` : ""}><td style="padding:6px 0 24px;">
            <a href="${escapeHtml(cta?.url || "")}" style="display:inline-block;background:${COLORS.accent};color:#FFF8F2;font-family:${SANS};font-size:16px;font-weight:bold;text-decoration:none;padding:14px 26px;border-radius:12px;">${escapeHtml(cta?.label || "")}</a>
          </td></tr>` : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.ground};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preheader || "")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.ground};">
  <tr><td align="center" style="padding:28px 12px 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
      <tr><td style="padding:0 16px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-family:${SERIF};font-size:22px;font-weight:bold;color:${COLORS.ink};">Skin by Laura Lo</td>
          <td align="right" style="font-family:${SANS};font-size:12px;color:${COLORS.muted};">Tampa, FL</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#FFFFFF;border:1px solid ${COLORS.line};border-radius:16px;padding:34px 28px 14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${content.eyebrow || editShared ? `<tr><td style="padding:0 0 12px;font-family:${SANS};font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${COLORS.accentText};"${edit(editShared, "eyebrow", "Small label (optional)")}>${escapeHtml(content.eyebrow || "")}</td></tr>` : ""}
          <tr><td style="padding:0 0 20px;font-family:${SERIF};font-size:30px;line-height:1.2;font-weight:bold;color:${COLORS.ink};"${edit(editShared, "headline", "Headline")}>${escapeHtml(content.headline)}</td></tr>
          <tr><td>${p(`Hi ${escapeHtml(greetingName)},`)}</td></tr>
          ${noteBlock}
          <tr><td${edit(editShared, "paragraphs", "Write the email here")}>${(paragraphs.length || !editShared ? paragraphs : [""]).map((text) => p(rich(text))).join("")}</td></tr>
          ${tipsBlock}
          ${productsBlock}
          ${ctaBlock}
          <tr><td style="padding:0 0 22px;font-family:${SANS};font-size:16px;line-height:1.6;color:${COLORS.ink};">See you soon,<br><span style="font-family:${SERIF};font-size:20px;font-weight:bold;">Laura</span></td></tr>
          ${psRow(content.ps, editShared, "ps", "Add a P.S. for everyone (optional)")}
          ${psRow(personal?.ps, editPersonal, "personalPs", "Add a P.S. just for this client (optional)")}
        </table>
      </td></tr>
      <tr><td align="center" style="padding:22px 16px 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${COLORS.muted};">
        Skin by Laura Lo · ${escapeHtml(BUSINESS_ADDRESS)}<br>
        You're getting this because you're a client of Skin by Laura Lo.<br>
        <a href="${escapeHtml(unsubscribeUrl)}" style="color:${COLORS.muted};">Unsubscribe</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    content.headline,
    "",
    `Hi ${greetingName},`,
    "",
    ...(note ? [`A note just for you: ${plain(note)}`, ""] : []),
    ...paragraphs.flatMap((paragraph) => [plain(paragraph), ""]),
    ...(tips.length ? [content.tipsTitle || "What helps", ...tips.map((tip, index) => `${index + 1}. ${plain(tip)}`), ""] : []),
    ...(products.length ? ["From the shop", ...products.flatMap((product) => [
      `${product.label ? `${product.label}: ` : ""}${product.name}${product.price ? ` (${product.price})` : ""}`,
      ...(product.goodFor ? [`Good for: ${product.goodFor}`] : []),
      ...(product.note ? [plain(product.note)] : []),
      ...(product.url ? [product.url] : []),
      "",
    ])] : []),
    ...(cta ? [`${cta.label}: ${cta.url}`, ""] : []),
    "See you soon,",
    "Laura",
    "",
    ...postscripts.flatMap((ps) => [`P.S. ${plain(ps)}`, ""]),
    `Skin by Laura Lo · ${BUSINESS_ADDRESS}`,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  return { subject: content.subject, html, text };
}
