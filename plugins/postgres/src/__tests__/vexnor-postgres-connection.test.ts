import { describe, expect, test, vi } from "vitest";
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

describe("VexnorPostgres.getSchema()", () => {
   test("returns tables, views, and enums from mocked connection", async () => {
      const plugin = new VexnorPostgres();

      const mockTables = [{ table_name: "account", table_schema: "public", columns: [{ column_name: "id", udt_name: "uuid" }], primary_keys: [{ constraint_name: "pk", table_schema: "public", table_name: "account", column_name: "id" }] }];
      const mockViews = [{ table_name: "account_summary", table_schema: "public", columns: [{ column_name: "total", udt_name: "int4" }] }];
      const mockEnums = [{ enum_name: "status", enum_schema: "public", enum_values: ["active", "inactive"] }];

      let callCount = 0;
      const mockDb = {
         query: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) return { rows: mockTables };
            if (callCount === 2) return { rows: mockViews };
            return { rows: mockEnums };
         }),
         options: { host: "localhost", port: 5432, user: "test", database: "testdb", password: null },
      };

      const createSpy = vi.spyOn(plugin, "createConnection").mockResolvedValue({
         db: mockDb,
         close: vi.fn(),
      } as never);

      try {
         const schema = await plugin.getSchema({ schemas: ["public"], host: "localhost", database: "testdb", user: "test" } as never);
         expect(schema.tables).toHaveLength(2);
         expect(schema.tables[0]!.table_type).toBe("table");
         expect(schema.tables[0]!.table_name).toBe("account");
         expect(schema.tables[1]!.table_type).toBe("view");
         expect(schema.tables[1]!.table_name).toBe("account_summary");
         expect(schema.enums).toHaveLength(1);
         expect(schema.enums[0]!.enum_name).toBe("status");
      } finally {
         createSpy.mockRestore();
      }
   });
});
