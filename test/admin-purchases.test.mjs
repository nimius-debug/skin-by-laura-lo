import { loadClientOrders } from "../src/admin/purchases.js";
import { getStoredOrders, replaceStoredOrders } from "../src/admin/db.js";
import { purchaseViewFrom } from "../src/admin/routine.js";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

// An in-memory stand-in for the three purchase tables, recognising the statements db.js sends.
function fakeDb() {
  const state = { orders: [], lines: [], syncs: new Map(), syncedAtText: "2026-10-12 10:00:00", statementCount: 0, maxParams: 0 };
  const exec = (sql, args) => {
    state.maxParams = Math.max(state.maxParams, args.length);
    if (sql.startsWith("DELETE FROM client_order_lines")) {
      const ids = new Set(state.orders.filter((o) => o.client_id === args[0]).map((o) => o.order_id));
      state.lines = state.lines.filter((l) => !ids.has(l.order_id));
    } else if (sql.startsWith("DELETE FROM client_orders")) {
      state.orders = state.orders.filter((o) => o.client_id !== args[0]);
    } else if (sql.startsWith("INSERT INTO client_orders")) {
      for (let i = 0; i < args.length; i += 5) {
        state.orders.push({ order_id: args[i], client_id: args[i + 1], ordered_at: args[i + 2], total_cents: args[i + 3], tip_cents: args[i + 4] });
      }
    } else if (sql.startsWith("INSERT INTO client_order_lines")) {
      for (let i = 0; i < args.length; i += 6) {
        state.lines.push({ order_id: args[i], line_uid: args[i + 1], catalog_object_id: args[i + 2], name: args[i + 3], quantity: args[i + 4], total_cents: args[i + 5] });
      }
    } else if (sql.startsWith("INSERT INTO client_purchase_syncs")) {
      state.syncs.set(args[0], state.syncedAtText);
    }
  };
  return {
    state,
    prepare(sql) {
      return {
        sql,
        args: [],
        bind(...args) { this.args = args; return this; },
        async first() {
          if (sql.includes("FROM client_purchase_syncs")) return state.syncs.has(this.args[0]) ? { synced_at: state.syncs.get(this.args[0]) } : null;
          return null;
        },
        async all() {
          if (sql.includes("FROM client_orders WHERE")) {
            return { results: state.orders.filter((o) => o.client_id === this.args[0]).sort((a, b) => b.ordered_at.localeCompare(a.ordered_at)) };
          }
          if (sql.includes("FROM client_order_lines l JOIN")) {
            const ids = new Set(state.orders.filter((o) => o.client_id === this.args[0]).map((o) => o.order_id));
            return { results: state.lines.filter((l) => ids.has(l.order_id)) };
          }
          return { results: [] };
        },
      };
    },
    async batch(statements) {
      state.statementCount = statements.length;
      for (const statement of statements) exec(statement.sql, statement.args);
    },
  };
}

const rawOrder = (id, date, lines, tip = 0) => ({
  id, created_at: date, total_money: { amount: lines.reduce((sum, l) => sum + l.total_money.amount, 0) + tip }, total_tip_money: { amount: tip },
  line_items: lines,
});
const line = (uid, catalogObjectId, name, cents, quantity = "1") => ({ uid, catalog_object_id: catalogObjectId, name, quantity, total_money: { amount: cents } });

let squareOrders = [
  rawOrder("o2", "2026-09-18T10:00:00Z", [line("a", "V1", "Mixi Clean", 3900), line("b", "SVC", "Acne Bootcamp Facial", 9000)], 1350),
  rawOrder("o1", "2026-03-01T10:00:00Z", [line("c", "V1", "Mixi Clean", 7800, "2")]),
];
let squareCalls = 0;
let squareDown = false;
globalThis.fetch = async (url) => {
  squareCalls += 1;
  if (squareDown) return new Response(JSON.stringify({ errors: [{ detail: "down" }] }), { status: 500 });
  return new Response(JSON.stringify({ orders: squareOrders }));
};

const db = fakeDb();
const env = { SQUARE_ACCESS_TOKEN: "x", SQUARE_LOCATION_ID: "L1", CLIENT_NOTES_DB: db };
const client = { id: "c1", square_customer_id: "SQ1" };
const T0 = Date.parse("2026-10-12T10:00:00Z");

const noSquare = await loadClientOrders(env, { id: "c2", square_customer_id: null }, { now: T0 });
check("a client with no Square customer has no orders and Square isn't called", [noSquare.source, noSquare.orders.length, squareCalls], ["none", 0, 0]);

const first = await loadClientOrders(env, client, { now: T0 });
check("the first load reads Square and stores the orders", [first.source, squareCalls, db.state.orders.length, db.state.lines.length], ["square", 1, 2, 3]);
check("each stored line keeps its price", db.state.lines.map((l) => l.total_cents).sort((a, b) => a - b), [3900, 7800, 9000]);

const second = await loadClientOrders(env, client, { now: T0 + 30 * 60 * 1000 });
check("30 minutes later the stored copy is used and Square isn't called", [second.source, squareCalls], ["stored", 1]);
check("the stored copy gives exactly the same orders as Square", second.orders, first.orders);
check("the stored copy gives the same spend as Square",
  purchaseViewFrom(second.orders, [{ name: "Mixi Clean", slug: "mc", variations: [{ id: "V1" }] }]).spend,
  purchaseViewFrom(first.orders, [{ name: "Mixi Clean", slug: "mc", variations: [{ id: "V1" }] }]).spend);
check("the stored copy says when it was synced", second.syncedAt, "2026-10-12T10:00:00Z");

const refreshed = await loadClientOrders(env, client, { refresh: true, now: T0 + 31 * 60 * 1000 });
check("Refresh from Square reads Square again", [refreshed.source, squareCalls], ["square", 2]);

const old = await loadClientOrders(env, client, { now: T0 + 61 * 60 * 1000 });
check("a copy over an hour old is replaced from Square", [old.source, squareCalls], ["square", 3]);

squareOrders = [squareOrders[0]];
await loadClientOrders(env, client, { refresh: true, now: T0 + 62 * 60 * 1000 });
check("a replaced copy drops orders Square no longer returns", [db.state.orders.length, db.state.lines.length], [1, 2]);

squareDown = true;
const offline = await loadClientOrders(env, client, { refresh: true, now: T0 + 63 * 60 * 1000 });
check("if Square is down, the stored copy is used and marked as saved", [offline.source, offline.orders.length], ["stored-stale", 1]);

const nothingStored = await loadClientOrders(env, { id: "c3", square_customer_id: "SQ3" }, { now: T0 }).catch((error) => error.message);
check("if Square is down and nothing is stored, it fails instead of showing nothing", typeof nothingStored === "string", true);

// A client with many orders must stay within D1's 100 parameters per statement.
const big = fakeDb();
const manyOrders = Array.from({ length: 45 }, (_, i) => ({
  id: `m${i}`, createdAt: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T10:00:00Z`, totalCents: 100, tipCents: 0,
  lines: [{ uid: "a", catalogObjectId: "V1", name: "x", quantity: 1, totalCents: 100 }, { uid: "b", catalogObjectId: "S", name: "y", quantity: 1, totalCents: 0 }],
}));
await replaceStoredOrders({ CLIENT_NOTES_DB: big }, "cBig", manyOrders);
check("many orders are inserted in chunks within D1's parameter limit", big.state.maxParams <= 100, true);
check("many orders use few statements, well inside D1's per-request limit", big.state.statementCount <= 15, true);
check("all of the orders and lines are stored", [big.state.orders.length, big.state.lines.length], [45, 90]);
const reread = await getStoredOrders({ CLIENT_NOTES_DB: big }, "cBig");
check("they read back newest first with their lines", [reread.orders.length, reread.orders[0].lines.length], [45, 2]);

console.log(failures === 0 ? "\nAll admin-purchases tests passed." : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
