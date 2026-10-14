// A stand-in for Cloudflare D1 backed by Node's built-in SQLite, so tests run the real SQL
// (including the migrations) instead of a hand-written fake. D1 and this both use SQLite.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

export function createD1({ migrations = [] } = {}) {
  const db = new DatabaseSync(":memory:");
  for (const sql of migrations) db.exec(sql);

  const prepare = (sql) => {
    let args = [];
    const statement = {
      sql,
      bind(...values) { args = values; return statement; },
      async first() { return db.prepare(sql).get(...args) ?? null; },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      async run() { const result = db.prepare(sql).run(...args); return { meta: { changes: result.changes } }; },
      runSync() { return db.prepare(sql).run(...args); },
    };
    return statement;
  };

  return {
    raw: db,
    prepare,
    // D1 runs a batch as one transaction.
    async batch(statements) {
      db.exec("BEGIN");
      try {
        for (const statement of statements) statement.runSync();
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

/** The repo's migrations, with 0002's data rows left out (they reference live client names). */
export function schemaMigrations() {
  const read = (name) => readFileSync(new URL(`../../migrations/${name}`, import.meta.url), "utf8");
  return [
    read("0001_client_notes.sql"),
    read("0002_client_source_files.sql").split(";")[0] + ";",
    read("0003_client_summaries.sql"),
    read("0004_client_purchases.sql"),
    read("0005_admin_login_attempts.sql"),
  ];
}
