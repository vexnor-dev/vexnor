import { describe, expect, test } from "vitest";
import { VexnorSqlite3 } from "#/vexnor-sqlite3.js";
import "#/sqlite3-augment.js";

describe("VexnorSqlite3 — createConnection", () => {
   const plugin = new VexnorSqlite3();

   test("createConnection with :memory: uri", async () => {
      const connection = await plugin.createConnection({
         config: { uri: ":memory:" },
      });
      expect(connection).toBeDefined();
      expect(connection.db).toBeDefined();
      await connection.close();
   });

   test("getSchema throws for config without uri", async () => {
      await expect(
         plugin.getSchema({ schemas: ["main"] } as never),
      ).rejects.toThrow("SQLite requires database file path");
   });
});

describe("VexnorSqlite3.getSchema()", () => {
   test("returns tables and views from in-memory database", async () => {
      const plugin = new VexnorSqlite3();

      const schema = await plugin.getSchema({ schemas: ["main"], uri: ":memory:" } as never);
      // Empty in-memory DB has no user tables
      expect(schema.tables).toMatchInlineSnapshot(`[]`);
      expect(schema.enums).toMatchInlineSnapshot(`[]`);
   });

   test("returns foreign keys from tables with FK constraints", async () => {
      const BetterSqlite3 = (await import("better-sqlite3")).default;
      const { mkdtempSync, rmSync } = await import("node:fs");
      const { join } = await import("node:path");
      const { tmpdir } = await import("node:os");
      const tmpDir = mkdtempSync(join(tmpdir(), "vexnor-sqlite-fk-"));
      const dbPath = join(tmpDir, "test.db");
      const db = new BetterSqlite3(dbPath);
      db.pragma("foreign_keys = ON");
      db.exec(`
         CREATE TABLE parent (id INTEGER PRIMARY KEY);
         CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id));
      `);
      db.close();

      try {
         const plugin = new VexnorSqlite3();
         const schema = await plugin.getSchema({ schemas: ["main"], uri: dbPath } as never);
         const child = schema.tables.find((t) => t.table_name === "child");
         expect(child?.foreign_keys).toMatchInlineSnapshot(`
           [
             {
               "column_name": "parent_id",
               "constraint_name": "fk_child_0",
               "referenced_column_name": "id",
               "referenced_table_name": "parent",
               "referenced_table_schema": "main",
               "table_name": "child",
               "table_schema": "main",
             },
           ]
         `);
      } finally {
         rmSync(tmpDir, { recursive: true });
      }
   });
});
