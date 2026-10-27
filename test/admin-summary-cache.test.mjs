import { handleAdminRequest } from "../src/admin/routes.js";
import { createSessionToken } from "../src/admin/auth.js";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

// A tiny in-memory stand-in for the D1 queries the insight route and client page use.
function fakeDb({ client, notes }) {
  const state = { notes, saved: null };
  return {
    state,
    prepare(sql) {
      return {
        bind: (...args) => ({
          first: async () => {
            if (sql.includes("FROM clients")) return client;
            if (sql.includes("FROM client_summaries")) return state.saved;
            return null;
          },
          all: async () => ({ results: sql.includes("FROM notes") ? state.notes : [] }),
          run: async () => {
            if (sql.includes("INSERT INTO client_summaries")) {
              state.saved = { input_hash: args[1], summary_json: args[2], model: args[3], created_at: "2026-10-12 03:11:00" };
            }
          },
        }),
      };
    },
  };
}

const note = (id, date, summary) => ({ id, note_date: date, summary, extracted_text: summary, confidence: "high", source: "square", pdf_key: null });
const client = { id: "c1", name: "Test Client", square_customer_id: null };
const db = fakeDb({ client, notes: [note("n1", "2026-01-02", "Peel felt fine")] });

const env = { ADMIN_USERNAME: "laura", ADMIN_PASSWORD: "pw-for-tests", ANTHROPIC_API_KEY: "test-key", CLIENT_NOTES_DB: db };
const cookie = `admin_session=${await createSessionToken(env)}`;

let apiCalls = 0;
globalThis.fetch = async (url) => {
  if (String(url).includes("api.anthropic.com")) {
    apiCalls += 1;
    const reply = { overview: `Summary number ${apiCalls}.`, flags: [], visits: [], products: [], watch: [], nextVisit: [] };
    return new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(reply) }] }));
  }
  return new Response("not available in this test", { status: 500 });
};

const insight = async (query = "") => {
  const url = `https://x.test/admin/clients/c1/insight${query}`;
  const response = await handleAdminRequest(new Request(url, { method: "POST", headers: { cookie } }), env, new URL(url));
  return { status: response.status, body: await response.json() };
};
const page = async () => {
  const url = "https://x.test/admin/clients/c1";
  const response = await handleAdminRequest(new Request(url, { headers: { cookie } }), env, new URL(url));
  return response.text();
};

const first = await insight();
check("the first summary calls the API once and is not cached", [apiCalls, first.body.cached], [1, false]);
check("the first summary is saved", Boolean(db.state.saved), true);

const second = await insight();
check("asking again with nothing changed makes no API call", apiCalls, 1);
check("the repeat is served from the saved summary", [second.body.cached, second.body.summary.overview], [true, "Summary number 1."]);

check("the page shows the saved summary as current, with no new call", (await page()).includes("so no new AI call is made"), true);
check("loading the page makes no API call either", apiCalls, 1);

db.state.notes = [...db.state.notes, note("n2", "2026-02-03", "Tingled on the cica mask!!")];
check("the page says the summary is out of date after a new note", (await page()).includes("have changed since"), true);
const afterNote = await insight();
check("a new note triggers exactly one new API call", [apiCalls, afterNote.body.cached], [2, false]);

const regenerated = await insight("?refresh=1");
check("Regenerate forces a fresh API call", [apiCalls, regenerated.body.cached], [3, false]);
check("the page offers Regenerate once the summary is current", (await page()).includes("Regenerate (new AI call)"), true);

// Square configured, but its orders can't be read: nothing should be summarized or paid for.
const squareDb = fakeDb({ client: { ...client, square_customer_id: "SQ1" }, notes: db.state.notes });
const squareEnv = { ...env, CLIENT_NOTES_DB: squareDb, SQUARE_ACCESS_TOKEN: "x", SQUARE_LOCATION_ID: "L1" };
const before = apiCalls;
const blockedUrl = "https://x.test/admin/clients/c1/insight";
const blocked = await handleAdminRequest(new Request(blockedUrl, { method: "POST", headers: { cookie } }), squareEnv, new URL(blockedUrl));
check("when Square orders can't be read, the summary is not run", [blocked.status, apiCalls], [503, before]);

console.log(failures === 0 ? "\nAll admin-summary-cache tests passed." : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
