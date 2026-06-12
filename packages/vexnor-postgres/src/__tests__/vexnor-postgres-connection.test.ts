import { describe, expect, test } from "vitest";
import { VexnorPostgres } from "#/vexnor-postgres.js";
import { getColumnType } from "#/schema/get-column-type.js";

describe("VexnorPostgres — createConnection", () => {
   const plugin = new VexnorPostgres();

   test("createConnection with uri config creates pool", async () => {
      // We can't actually connect, but we can verify it creates a connection
      // and the close function works without error
      const connection = await plugin.createConnection({
         config: { uri: "postgresql://localhost:5432/test_nonexistent_db" },
      });
      expect(connection).toBeDefined();
      expect(connection.db).toBeDefined();
      // Close immediately — this just calls pool.end()
      await connection.close();
   });

   test("createConnection with host/port config creates pool", async () => {
      const connection = await plugin.createConnection({
         config: { host: "localhost", port: 5432, database: "test_db", user: "test", password: "test" },
      });
      expect(connection).toBeDefined();
      expect(connection.db).toBeDefined();
      await connection.close();
   });
});

describe("VexnorPostgres — additional getColumnType branches", () => {
   const base = {
      column_default: null,
      column_name: "col",
      is_nullable: "NO" as const,
      is_updatable: "YES" as const,
      table_schema: "public",
      table_name: "test",
   };

   test("numeric without precision_radix => Number", () => {
      expect(getColumnType({ ...base, udt_name: "numeric" })).toMatchInlineSnapshot(`
        {
          "type": "number",
        }
      `);
   });

   test("USER-DEFINED with both udt_name and domain_name uses udt_name", () => {
      expect(
         getColumnType({ ...base, udt_name: "my_type", domain_name: "my_domain", data_type: "USER-DEFINED" }),
      ).toMatchInlineSnapshot(`
        {
          "type": "Udt",
          "udt": "my_type",
        }
      `);
   });
});
