import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { ValnorSqlite3 } from "../valnor-sqlite3.js";
import BetterSqlite3 from "better-sqlite3";
import { sql, param } from "valnor";
import { Account } from "valnor/testing";
import "../valnor-sqlite3.js";

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
      const plugin = new ValnorSqlite3();
      const connection = await plugin.createConnection({ uri: dbPath });
      expect(connection).toBeDefined();
   });

   test("should generate schema from SQLite database", async () => {
      const plugin = new ValnorSqlite3();
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
      const result = await query.sqlite3.run({
         db,
         params: { firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
      });
      expect(result.changes).toBe(1);
   });

   test("should handle SELECT operation", async () => {
      const query = sql`SELECT ${Account.$$} FROM ${Account}`;
      const rows = await query.sqlite3.getAll({ db });
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
   });

   test("should handle UPDATE operation", async () => {
      const query = sql`
         UPDATE ${Account}
         SET ${Account.$firstName} = ${param<{ firstName: string }>("firstName")}
         WHERE ${Account.$accountId} = ${param<{ id: number }>("id")}
      `;
      const result = await query.sqlite3.run({ db, params: { firstName: "Janet", id: 1 } });
      expect(result.changes).toBeGreaterThanOrEqual(0);
   });

   test("should handle DELETE operation", async () => {
      const insertQuery = sql`
         INSERT INTO ${Account} (${Account.$firstName}, ${Account.$email})
         VALUES ('ToDelete', 'delete@example.com')
      `;
      const insertResult = await insertQuery.sqlite3.run({ db });
      const deleteId = insertResult.lastInsertRowid;

      const deleteQuery = sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${param<{ id: number | bigint }>("id")}`;
      const result = await deleteQuery.sqlite3.run({ db, params: { id: deleteId } });
      expect(result.changes).toBe(1);
   });
});
