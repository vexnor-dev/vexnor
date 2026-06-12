import { describe, expect, test } from "vitest";
import { VexnorSqlite3 } from "#/vexnor-sqlite3.js";

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
