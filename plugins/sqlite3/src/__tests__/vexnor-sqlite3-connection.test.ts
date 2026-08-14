import { describe, expect, test } from "vitest";
import { VexnorSqlite3 } from "#src/vexnor-sqlite3.js";
import "#src/sqlite3-augment.js";

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

describe("VexnorSqlite3.discoverSchemas()", () => {
   test("discovers the main SQLite namespace", async () => {
      const plugin = new VexnorSqlite3();
      await expect(plugin.discoverSchemas({ uri: ":memory:" })).resolves.toMatchInlineSnapshot(`
        [
          {
            "name": "main",
            "system": false,
          },
        ]
      `);
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
               "ordinal_position": 1,
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

   test("preserves every column of a composite primary key", async () => {
      const BetterSqlite3 = (await import("better-sqlite3")).default;
      const { mkdtempSync, rmSync } = await import("node:fs");
      const { join } = await import("node:path");
      const { tmpdir } = await import("node:os");
      const tmpDir = mkdtempSync(join(tmpdir(), "vexnor-sqlite-composite-pk-"));
      const dbPath = join(tmpDir, "test.db");
      const db = new BetterSqlite3(dbPath);
      db.exec(`
         CREATE TABLE composite_record (
            segment_id INTEGER NOT NULL,
            record_id INTEGER NOT NULL,
            payload TEXT,
            PRIMARY KEY (segment_id, record_id)
         );
      `);

      db.close();

      try {
         const plugin = new VexnorSqlite3();
         const schema = await plugin.getSchema({ schemas: ["main"], uri: dbPath });
         const compositeRecord = schema.tables.find((table) => table.table_name === "composite_record");
         expect(compositeRecord?.primary_keys).toHaveLength(2);
      } finally {
         rmSync(tmpDir, { recursive: true });
      }
   });
});
