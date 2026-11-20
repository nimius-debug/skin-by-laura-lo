// Draws a guide's pages as HTML: each page is an A4 sheet (794 x 1123 CSS px)
// with its boxes absolutely placed, so the screen, the editor and the printed
// PDF all come from the same markup.
//
// `guideElementHtml` and `guideSheetHtml` are written without imports or
// outside variables on purpose: the editor's script (editor-client.js) embeds
// their source, so the browser redraws a box exactly the way the server does.

import { FONTS, PAGE_HEIGHT, PAGE_WIDTH, PAPER, INK } from "./model.js";

export const FONT_CSS = Object.fromEntries(Object.entries(FONTS).map(([key, font]) => [key, font.css]));

/** One box. Text markup is already sanitized (model.js); attributes are escaped here. */
export function guideElementHtml(element, fonts) {
  const attr = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const style = element.style || {};
  const css = [`left:${element.x}px`, `top:${element.y}px`, `width:${element.w}px`];
  if (element.type !== "text" || element.h !== undefined) css.push(`height:${element.h}px`);
  if (style.opacity !== undefined && style.opacity !== 1) css.push(`opacity:${style.opacity}`);
  let inner = "";
  if (element.type === "text") {
    css.push(`font-family:${fonts[style.font] || fonts.body}`);
    css.push(`font-size:${style.fontSize || 16}px`);
    css.push(`font-weight:${style.fontWeight || 400}`);
    css.push(`line-height:${style.lineHeight || 1.25}`);
    if (style.letterSpacing) css.push(`letter-spacing:${style.letterSpacing}em`);
    if (style.align) css.push(`text-align:${style.align}`);
    if (style.uppercase) css.push("text-transform:uppercase");
    if (style.italic) css.push("font-style:italic");
    if (style.color) css.push(`color:${style.color}`);
    inner = element.html || "";
  } else if (element.type === "image") {
    inner = `<img src="${attr(element.src)}" alt="${attr(element.alt)}" style="object-fit:${element.fit === "cover" ? "cover" : "contain"}" draggable="false">`;
  } else if (element.type === "line") {
    css.push(`border-top:${style.strokeWidth || 1}px solid ${style.color || "#000000"}`);
  }
  const data = [`data-id="${attr(element.id)}"`, `data-origin="${attr(element.origin)}"`];
  if (element.role) data.push(`data-role="${attr(element.role)}"`);
  if (element.note) data.push(`title="${attr(element.note)}"`);
  return `<div class="el el-${element.type}" ${data.join(" ")} style="${attr(css.join(";"))}">${inner}</div>`;
}

/** One page, with its boxes. */
export function guideSheetHtml(page, index, fonts) {
  const attr = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<section class="sheet" data-page="${attr(page.id)}" data-index="${index}" aria-label="Page ${index + 1}">${page.elements.map((element) => guideElementHtml(element, fonts)).join("")}</section>`;
}

/** The sheet styles, used by the editor on screen and when printing to PDF. */
export const SHEET_CSS = `
.sheet { position: relative; width: ${PAGE_WIDTH}px; height: ${PAGE_HEIGHT}px; overflow: hidden; background: ${PAPER}; color: ${INK};
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sheet .el { position: absolute; box-sizing: border-box; overflow-wrap: break-word; }
.sheet .el-text { white-space: normal; hyphens: manual; }
.sheet .el-text b { font-weight: 700; }
.sheet .el-image img { display: block; width: 100%; height: 100%; object-position: center bottom; pointer-events: none; }
.sheet .el-line { height: 0 !important; }
@page { size: A4; margin: 0; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: ${PAPER} !important; }
  .no-print { display: none !important; }
  .print-root, .page-stack { display: block !important; padding: 0 !important; margin: 0 !important; gap: 0 !important; overflow: visible !important; }
  .sheet-frame { margin: 0 !important; padding: 0 !important; box-shadow: none !important; break-after: page; page-break-after: always; }
  .sheet-frame:last-child { break-after: auto; page-break-after: auto; }
  .sheet-box { width: auto !important; height: auto !important; box-shadow: none !important; }
  /* Exactly one A4 sheet, so a rounding pixel never spills onto a blank page. */
  .sheet { transform: none !important; width: 210mm; height: 297mm; outline: none !important; }
  .sheet .el { outline: none !important; box-shadow: none !important; background: transparent !important; text-decoration: none !important; }
  .sheet .selection { display: none !important; }
}
`;
