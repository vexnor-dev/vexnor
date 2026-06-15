// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { VexnorSqlite3 } from "#/vexnor-sqlite3.js";
import BetterSqlite3 from "better-sqlite3";
import { sql, param, row } from "@vexnor/core";
import { Account } from "@vexnor/core/testing";
import { jsonOne, jsonMany } from "#/charms/json-aggregation-sqlite3.js";
import "@vexnor/sqlite3";
import "#/sqlite3-augment.js";

describe("integration tests", () => {
   let db: BetterSqlite3.Database;
   const dbPath = ":memory:";

   beforeAll(() => {
      db = new BetterSqlite3(dbPath);
      db.exec(`
         CREATE TABLE account (
            account_id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT,
            last_name TEXT,
            email TEXT,
            status TEXT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            modified_at TEXT DEFAULT CURRENT_TIMESTAMP,
            parent_id INTEGER
         )
      `);
   });

   afterAll(() => {
      db.close();
   });

   test("should connect to SQLite database", async () => {
      const plugin = new VexnorSqlite3();
      const connection = await plugin.createConnection({ config: { uri: dbPath } });
      expect(connection).toBeDefined();
   });

   test("should generate schema from SQLite database", async () => {
      const plugin = new VexnorSqlite3();
      const schema = await plugin.getSchema({ uri: dbPath, schemas: ["main"] });
      expect(schema).toBeDefined();
      expect(schema.tables).toBeDefined();
      expect(Array.isArray(schema.tables)).toBe(true);
   });

   test("should handle INSERT operation", async () => {
      const query = sql`
         INSERT INTO ${Account} (${Account.$firstName}, ${Account.$lastName}, ${Account.$email})
         VALUES (${param<{ firstName: string }>("firstName")}, ${param<{ lastName: string }>("lastName")}, ${param<{ email: string }>("email")})
      `;
      const result = await query.sqlite.run({
         db,
         params: { firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
      });
      expect(result.changes).toBe(1);
   });

   test("should handle SELECT operation", async () => {
      const query = sql`SELECT ${Account.$$} FROM ${Account}`;
      const rows = await query.sqlite.all({ db });
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
   });

   test("should handle UPDATE operation", async () => {
      const query = sql`
         UPDATE ${Account}
         SET ${Account.$firstName} = ${param<{ firstName: string }>("firstName")}
         WHERE ${Account.$accountId} = ${param<{ id: number }>("id")}
      `;
      const result = await query.sqlite.run({ db, params: { firstName: "Janet", id: 1 } });
      expect(result.changes).toBeGreaterThanOrEqual(0);
   });

   test("should handle DELETE operation", async () => {
      const insertQuery = sql`
         INSERT INTO ${Account} (${Account.$firstName}, ${Account.$email})
         VALUES ('ToDelete', 'delete@example.com')
      `;
      const insertResult = await insertQuery.sqlite.run({ db });
      const deleteId = insertResult.lastInsertRowid;

      const deleteQuery = sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${param<{ id: number | bigint }>("id")}`;
      const result = await deleteQuery.sqlite.run({ db, params: { id: deleteId } });
      expect(result.changes).toBe(1);
   });

   test("should handle jsonMany aggregation", async () => {
      const parentQuery = sql`
         INSERT INTO ${Account} (${Account.$firstName}, ${Account.$lastName}, ${Account.$email})
         VALUES ('Parent', 'Account', 'parent@example.com')
      `;
      const parentResult = await parentQuery.sqlite.run({ db });
      const parentId = parentResult.lastInsertRowid;

      await sql`
         INSERT INTO ${Account} (${Account.$firstName}, ${Account.$lastName}, ${Account.$email}, ${Account.$parentId})
         VALUES ('Child1', 'Account', 'child1@example.com', ${param<{ parentId: number | bigint }>("parentId")})
      `.sqlite.run({ db, params: { parentId } });

      await sql`
         INSERT INTO ${Account} (${Account.$firstName}, ${Account.$lastName}, ${Account.$email}, ${Account.$parentId})
         VALUES ('Child2', 'Account', 'child2@example.com', ${param<{ parentId: number | bigint }>("parentId")})
      `.sqlite.run({ db, params: { parentId } });

      const AccountChildren = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${Account.$parentId} = ${Account.out.$accountId}
      `;

      const query = sql`
         SELECT ${row(Account.$$)}, ${jsonMany(AccountChildren).as("children")}
         FROM ${Account}
         WHERE ${Account.$accountId} = ${param<{ id: number | bigint }>("id")}
      `;

      const result = await query.sqlite.any({ db, params: { id: parentId } });
      expect(result).toBeDefined();
      expect(result?.children).toBeDefined();
      const children = result!.children;
      expect(Array.isArray(children)).toBe(true);
      expect(children.length).toBe(2);
   });

   test("should handle jsonOne aggregation", async () => {
      const AccountParent = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${Account.$accountId} = ${Account.out.$parentId}
      `;

      const query = sql`
         SELECT ${row(Account.$$)}, ${jsonOne(AccountParent).as("parent")}
         FROM ${Account}
         WHERE ${Account.$parentId} IS NOT NULL
         LIMIT 1
      `;

      const result = await query.sqlite.any({ db });
      if (result) {
         expect(result.parent).toBeDefined();
         const parent = result.parent;
         if (parent) {
            expect(parent.accountId).toBe(result.parentId);
         }
      }
   });
});
