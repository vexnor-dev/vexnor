// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { sql as sqlite3Sql } from "#/sqlite3-sql.js";
import { row, param } from "@vexnor/core";
import { Account } from "@vexnor/core/testing";
import BetterSqlite3 from "better-sqlite3";
import "@vexnor/sqlite3";
import "#/sqlite3-augment.js";

let db: BetterSqlite3.Database;

beforeAll(() => {
   db = new BetterSqlite3(":memory:");
   db.exec(`
      CREATE TABLE main.account (
         account_id INTEGER PRIMARY KEY AUTOINCREMENT,
         first_name TEXT,
         last_name TEXT,
         email TEXT,
         status TEXT DEFAULT 'created',
         notes TEXT,
         created_at TEXT DEFAULT CURRENT_TIMESTAMP,
         modified_at TEXT DEFAULT CURRENT_TIMESTAMP,
         parent_id INTEGER
      )
   `);
   db.exec(`INSERT INTO main.account (first_name, last_name, email) VALUES ('Jane', 'Doe', 'jane@example.com')`);
});

afterAll(() => {
   db.close();
});

describe("sqlite3 sql tag", () => {
   test("returns handler with .all()", async () => {
      const q = sqlite3Sql`SELECT ${Account.$$} FROM ${Account}`;
      const rows = await q.all({ db });
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
   });

   test("returns handler with .one()", async () => {
      const q = sqlite3Sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${param<{ id: number }>("id")}`;
      const result = await q.one({ db, params: { id: 1 } });
      expect(result).toBeDefined();
   });

   test("returns handler with .any() — found", async () => {
      const q = sqlite3Sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$email} = ${param<{ email: string }>("email")}`;
      const result = await q.any({ db, params: { email: "jane@example.com" } });
      expect(result).toBeDefined();
   });

   test("returns handler with .any() — not found", async () => {
      const q = sqlite3Sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$email} = ${param<{ email: string }>("email")}`;
      const result = await q.any({ db, params: { email: "nobody@nowhere.com" } });
      expect(result).toBeUndefined();
   });

   test("returns handler with .run()", async () => {
      const q = sqlite3Sql`INSERT INTO ${Account} (${Account.$firstName}, ${Account.$email}) VALUES ('Test', 'test@test.com')`;
      const result = await q.run({ db });
      expect(result.changes).toBe(1);
   });

   test("exposes .source with query id", () => {
      const q = sqlite3Sql`SELECT ${Account.$$} FROM ${Account}`;
      expect(q.source).toBeDefined();
      expect(q.source.id).toBeDefined();
   });
});
