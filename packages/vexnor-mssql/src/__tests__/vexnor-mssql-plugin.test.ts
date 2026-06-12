import { describe, expect, test, vi } from "vitest";
import { VexnorMssql } from "#/vexnor-mssql.js";
import { sql } from "#/mssql-sql.js";

describe("VexnorMssql plugin class", () => {
   const plugin = new VexnorMssql();

   test("name is vexnor-mssql", () => {
      expect(plugin.name).toMatchInlineSnapshot(`"vexnor-mssql"`);
   });

   test("driver is mssql", () => {
      expect(plugin.driver).toMatchInlineSnapshot(`"mssql"`);
   });

   test("dialect is tsql", () => {
      expect(plugin.dialect).toMatchInlineSnapshot(`"tsql"`);
   });

   test("getLibrary returns empty array", () => {
      expect(plugin.getLibrary()).toMatchInlineSnapshot(`[]`);
   });

   test("newQueryHandler returns a handler with correct pluginName", () => {
      const q = sql`SELECT 1 as id`;
      const handler = plugin.newQueryHandler(q.source);
      expect(handler.pluginName).toMatchInlineSnapshot(`"vexnor-mssql"`);
   });

   test("getColumnType delegates to get-column-type module", () => {
      const col = {
         column_default: null,
         column_name: "id",
         is_nullable: "NO" as const,
         is_updatable: "YES" as const,
         table_schema: "dbo",
         table_name: "test",
         udt_name: "int",
      };
      const result = plugin.getColumnType(col);
      expect(result).toMatchInlineSnapshot(`
        {
          "type": "number",
        }
      `);
   });

   test("getColumnType - varchar returns String", () => {
      expect(
         plugin.getColumnType({
            column_default: null,
            column_name: "name",
            is_nullable: "NO" as const,
            is_updatable: "YES" as const,
            table_schema: "dbo",
            table_name: "test",
            udt_name: "varchar",
         }),
      ).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("getColumnType - bit returns Boolean", () => {
      expect(
         plugin.getColumnType({
            column_default: null,
            column_name: "active",
            is_nullable: "NO" as const,
            is_updatable: "YES" as const,
            table_schema: "dbo",
            table_name: "test",
            udt_name: "bit",
         }),
      ).toMatchInlineSnapshot(`
        {
          "type": "boolean",
        }
      `);
   });

   test("getColumnType - datetime returns Date", () => {
      expect(
         plugin.getColumnType({
            column_default: null,
            column_name: "created",
            is_nullable: "NO" as const,
            is_updatable: "YES" as const,
            table_schema: "dbo",
            table_name: "test",
            udt_name: "datetime2",
         }),
      ).toMatchInlineSnapshot(`
        {
          "type": "Date",
        }
      `);
   });

   test("createConnection throws for invalid config (missing host/database/user)", async () => {
      await expect(
         plugin.createConnection({
            config: { host: undefined, database: undefined, user: undefined } as never,
         }),
      ).rejects.toThrow("Invalid database connection parameters");
   });

   test("createConnection throws for empty host/database/user strings", async () => {
      await expect(
         plugin.createConnection({
            config: { host: "", database: "", user: "" } as never,
         }),
      ).rejects.toThrow("Invalid database connection parameters");
   });
});

describe("VexnorMssql.getSchema()", () => {
   test("returns tables and views from mocked connection", async () => {
      const plugin = new VexnorMssql();
      const mockTableResult = {
         recordsets: [[
            { table_name: "account", table_schema: "dbo", table_columns: JSON.stringify([{ column_name: "id", udt_name: "int" }]), primary_key: "id" },
         ]],
         recordset: [{ table_name: "account", table_schema: "dbo", table_columns: JSON.stringify([{ column_name: "id", udt_name: "int" }]), primary_key: "id" }],
         rowsAffected: [1],
         output: {},
      };
      const mockViewResult = {
         recordsets: [[
            { table_name: "account_summary", table_schema: "dbo", table_columns: JSON.stringify([{ column_name: "total", udt_name: "int" }]) },
         ]],
         recordset: [{ table_name: "account_summary", table_schema: "dbo", table_columns: JSON.stringify([{ column_name: "total", udt_name: "int" }]) }],
         rowsAffected: [1],
         output: {},
      };

      let callCount = 0;
      const mockRequest = {
         input: vi.fn().mockReturnThis(),
         query: vi.fn().mockImplementation(() => {
            callCount++;
            return Promise.resolve(callCount === 1 ? mockTableResult : mockViewResult);
         }),
      };
      const mockPool = {
         request: () => mockRequest,
         driver: "tedious",
         close: vi.fn(),
      };

      const createSpy = vi.spyOn(plugin, "createConnection").mockResolvedValue({
         db: mockPool,
         close: vi.fn(),
      } as never);

      try {
         const schema = await plugin.getSchema({ schemas: ["dbo"], host: "localhost", database: "test", user: "sa", password: "pass" } as never);
         expect(schema.tables).toHaveLength(2);
         expect(schema.tables[0]!.table_type).toBe("table");
         expect(schema.tables[0]!.table_name).toBe("account");
         expect(schema.tables[1]!.table_type).toBe("view");
         expect(schema.tables[1]!.table_name).toBe("account_summary");
         expect(schema.enums).toMatchInlineSnapshot(`[]`);
      } finally {
         createSpy.mockRestore();
      }
   });
});
