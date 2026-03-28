import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { sql, param, row } from "valnor";
import { Account } from "valnor/testing";
import BetterSqlite3 from "better-sqlite3";
import "../valnor-sqlite3.js";

describe("better-sqlite3 query handler tests", () => {
   let db: BetterSqlite3.Database;

   beforeAll(() => {
      db = new BetterSqlite3(":memory:");
      db.exec(`
         CREATE TABLE main.account (
            account_id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT,
            last_name TEXT,
            email TEXT,
            status TEXT,
            notes TEXT,
            created_at TEXT,
            modified_at TEXT,
            parent_id INTEGER
         )
      `);
   });

   afterAll(() => {
      db.close();
   });

   test("should execute run() and return RunResult", async () => {
      const query = sql`INSERT INTO ${Account} (${Account.$firstName}, ${Account.$email}) VALUES ('John', 'john@example.com')`;
      const result = await query.sqlite.run({ db });
      expect(result.changes).toBe(1);
   });

   test("should execute getAll() and return rows", async () => {
      const query = sql`SELECT ${Account.$$} FROM ${Account}`;
      const rows = await query.sqlite.all({ db });
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
   });

   test("should execute getOneRequired() and return single row", async () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${param<{ id: number }>("id")}`;
      const one = await query.sqlite.one({ db, params: { id: 1 } });
      expect(one).toBeDefined();
      expect(one.accountId).toBe(1);
   });

   test("should execute getOneOptional() and return row or undefined", async () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${param<{ id: number }>("id")}`;
      const one = await query.sqlite.any({ db, params: { id: 999 } });
      expect(one).toBeUndefined();
   });

   test("should throw error when getOneRequired() finds 0 rows", async () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${param<{ id: number }>("id")}`;
      await expect(query.sqlite.one({ db, params: { id: 999 } })).rejects.toThrow();
   });

   test("should handle queries with parameters", async () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$firstName} = ${param<{ name: string }>("name")}`;
      const rows = await query.sqlite.all({ db, params: { name: "John" } });
      expect(Array.isArray(rows)).toBe(true);
   });

   test("should handle queries without parameters", async () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const rows = await query.sqlite.all({ db });
      expect(Array.isArray(rows)).toBe(true);
   });

   test("should apply debug callback when provided", async () => {
      let debugCalled = false;
      const query = sql`SELECT ${Account.$$} FROM ${Account}`;
      await query.sqlite.all({
         db,
         options: {
            debug: () => {
               debugCalled = true;
            },
         },
      });
      expect(debugCalled).toBe(true);
   });
});
