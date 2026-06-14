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
});
