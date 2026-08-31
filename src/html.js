// Minimal HTML helpers.
//
// `html` is an auto-escaping tagged template: every interpolated value is
// escaped unless it is already trusted markup (a nested `html` result, or a
// value explicitly wrapped in `raw`). Product names and descriptions come
// from Square, so escaping is the default rather than something to remember.

const RAW = Symbol("raw-html");

export function escape(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Mark a string as trusted markup that must not be escaped. */
export function raw(value) {
  return { [RAW]: String(value ?? "") };
}

function render(value) {
  if (value === null || value === undefined || value === false) return "";
  if (typeof value === "object" && RAW in value) return value[RAW];
  if (Array.isArray(value)) return value.map(render).join("");
  return escape(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let index = 0; index < values.length; index += 1) {
    out += render(values[index]) + strings[index + 1];
  }
  return raw(out);
}

/** Collapse an html`` result (or plain string) to a string for the response. */
export function toString(value) {
  return render(value);
}

/** Safe for embedding arbitrary data inside a <script> block. */
export function jsonScript(value) {
  return raw(
    JSON.stringify(value)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029"),
  );
}
