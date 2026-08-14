import { describe, expect, test, vi } from "vitest";
import { VexnorMssql } from "#src/vexnor-mssql.js";
import { sql } from "#src/mssql-sql.js";

describe("VexnorMssql plugin class", () => {
   const plugin = new VexnorMssql();

   test("name is @vexnor/mssql", () => {
      expect(plugin.name).toMatchInlineSnapshot(`"@vexnor/mssql"`);
   });

   test("driver is mssql", () => {
      expect(plugin.driver).toMatchInlineSnapshot(`"mssql"`);
   });

   test("dialect is tsql", () => {
      expect(plugin.dialect).toMatchInlineSnapshot(`"tsql"`);
   });

   test("version matches the package version", () => {
      expect(plugin.version).toMatchInlineSnapshot(`"1.0.0-beta.3"`);
   });

   test("getLibrary returns empty array", () => {
      expect(plugin.getLibrary()).toMatchInlineSnapshot(`[]`);
   });

   test("newQueryHandler returns a handler with correct pluginName", () => {
      const q = sql`SELECT 1 as id`;
      const handler = plugin.newQueryHandler(q.source);
      expect(handler.pluginName).toMatchInlineSnapshot(`"@vexnor/mssql"`);
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
            { table_name: "account", table_schema: "dbo", table_columns: JSON.stringify([{ column_name: "tenant_id", udt_name: "int" }, { column_name: "account_id", udt_name: "int" }]) },
            { table_name: "event_log", table_schema: "dbo", table_columns: JSON.stringify([{ column_name: "message", udt_name: "varchar" }]) },
            { table_name: "product", table_schema: "dbo", table_columns: JSON.stringify([{ column_name: "id", udt_name: "int" }]) },
         ]],
         recordset: [
            { table_name: "account", table_schema: "dbo", table_columns: JSON.stringify([{ column_name: "tenant_id", udt_name: "int" }, { column_name: "account_id", udt_name: "int" }]) },
            { table_name: "event_log", table_schema: "dbo", table_columns: JSON.stringify([{ column_name: "message", udt_name: "varchar" }]) },
            { table_name: "product", table_schema: "dbo", table_columns: JSON.stringify([{ column_name: "id", udt_name: "int" }]) },
         ],
         rowsAffected: [3],
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
      const mockPrimaryKeyResult = {
         recordsets: [[
            { table_schema: "dbo", table_name: "account", constraint_name: "pk_account", column_name: "tenant_id", ordinal_position: 1 },
            { table_schema: "dbo", table_name: "account", constraint_name: "pk_account", column_name: "account_id", ordinal_position: 2 },
            { table_schema: "dbo", table_name: "product", constraint_name: "pk_product", column_name: "id", ordinal_position: 1 },
         ]],
         recordset: [
            { table_schema: "dbo", table_name: "account", constraint_name: "pk_account", column_name: "tenant_id", ordinal_position: 1 },
            { table_schema: "dbo", table_name: "account", constraint_name: "pk_account", column_name: "account_id", ordinal_position: 2 },
            { table_schema: "dbo", table_name: "product", constraint_name: "pk_product", column_name: "id", ordinal_position: 1 },
         ],
         rowsAffected: [3],
         output: {},
      };
      const mockFkResult = {
         recordsets: [[
            { table_schema: "dbo", table_name: "account", column_name: "parent_id", constraint_name: "fk_parent", referenced_table_schema: "dbo", referenced_table_name: "account", referenced_column_name: "account_id", ordinal_position: 1 },
         ]],
         recordset: [{ table_schema: "dbo", table_name: "account", column_name: "parent_id", constraint_name: "fk_parent", referenced_table_schema: "dbo", referenced_table_name: "account", referenced_column_name: "account_id", ordinal_position: 1 }],
         rowsAffected: [1],
         output: {},
      };

      let callCount = 0;
      const mockResults = [mockTableResult, mockViewResult, mockPrimaryKeyResult, mockFkResult];
      const mockRequest = {
         input: vi.fn().mockReturnThis(),
         query: vi.fn().mockImplementation(() => {
            return Promise.resolve(mockResults[callCount++]);
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
         expect(schema.tables).toHaveLength(4);
         expect(schema.tables[0]!.table_type).toBe("table");
         expect(schema.tables[0]!.table_name).toBe("account");
         expect(schema.tables[0]!.primary_keys).toMatchInlineSnapshot(`
           [
             {
               "column_name": "tenant_id",
               "constraint_name": "pk_account",
               "ordinal_position": 1,
               "table_name": "account",
               "table_schema": "dbo",
             },
             {
               "column_name": "account_id",
               "constraint_name": "pk_account",
               "ordinal_position": 2,
               "table_name": "account",
               "table_schema": "dbo",
             },
           ]
         `);
         expect(schema.tables[0]!.foreign_keys).toMatchInlineSnapshot(`
           [
             {
               "column_name": "parent_id",
               "constraint_name": "fk_parent",
               "ordinal_position": 1,
               "referenced_column_name": "account_id",
               "referenced_table_name": "account",
               "referenced_table_schema": "dbo",
               "table_name": "account",
               "table_schema": "dbo",
             },
           ]
         `);
         expect(schema.tables[1]!.table_name).toBe("event_log");
         expect(schema.tables[1]!.primary_keys).toMatchInlineSnapshot(`[]`);
         expect(schema.tables[1]!.foreign_keys).toMatchInlineSnapshot(`[]`);
         expect(schema.tables[2]!.table_name).toBe("product");
         expect(schema.tables[2]!.foreign_keys).toMatchInlineSnapshot(`[]`);
         expect(schema.tables[3]!.table_type).toBe("view");
         expect(schema.tables[3]!.table_name).toBe("account_summary");
         expect(schema.tables[3]!.foreign_keys).toMatchInlineSnapshot(`[]`);
         expect(schema.enums).toMatchInlineSnapshot(`[]`);
      } finally {
         createSpy.mockRestore();
      }
   });

   test("handles FK query error gracefully", async () => {
      const plugin = new VexnorMssql();
      let callCount = 0;
      const mockRequest = {
         input: vi.fn().mockReturnThis(),
         query: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 4) return Promise.reject(new Error("FK query failed"));
            return Promise.resolve({
               recordsets: [[]],
               recordset: [],
               rowsAffected: [0],
               output: {},
            });
         }),
      };
      const mockPool = { request: () => mockRequest, driver: "tedious", close: vi.fn() };
      const createSpy = vi.spyOn(plugin, "createConnection").mockResolvedValue({ db: mockPool, close: vi.fn() } as never);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      try {
         await expect(plugin.getSchema({ schemas: ["dbo"], uri: "test://localhost" } as never)).rejects.toThrow("FK query failed");
         expect(consoleSpy).toHaveBeenCalled();
      } finally {
         createSpy.mockRestore();
         consoleSpy.mockRestore();
      }
   });

   test("handles primary-key query errors gracefully", async () => {
      const plugin = new VexnorMssql();
      let callCount = 0;
      const mockRequest = {
         input: vi.fn().mockReturnThis(),
         query: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 3) return Promise.reject(new Error("Primary-key query failed"));
            return Promise.resolve({
               recordsets: [[]],
               recordset: [],
               rowsAffected: [0],
               output: {},
            });
         }),
      };
      const mockPool = { request: () => mockRequest, driver: "tedious", close: vi.fn() };
      const createSpy = vi.spyOn(plugin, "createConnection").mockResolvedValue({ db: mockPool, close: vi.fn() } as never);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      try {
         await expect(plugin.getSchema({ schemas: ["dbo"], uri: "test://localhost" } as never)).rejects.toThrow("Primary-key query failed");
         expect(consoleSpy).toHaveBeenCalled();
      } finally {
         createSpy.mockRestore();
         consoleSpy.mockRestore();
      }
   });
});

describe("VexnorMssql.discoverSchemas()", () => {
   test("discovers and classifies SQL Server schemas", async () => {
      const plugin = new VexnorMssql();
      const schemas = await plugin.discoverSchemas({
         host: process.env.MSSQL_HOST ?? "localhost",
         port: Number(process.env.MSSQL_PORT ?? 1433),
         database: process.env.MSSQL_DATABASE ?? "vexnor",
         user: process.env.MSSQL_USER ?? "vexnor_dev",
         password: process.env.MSSQL_PASSWORD ?? "P@ssw0rd!",
      });

      expect({
         dbo: schemas.find(({ name }) => name === "dbo"),
         informationSchema: schemas.find(({ name }) => name === "INFORMATION_SCHEMA"),
         sys: schemas.find(({ name }) => name === "sys"),
      }).toMatchInlineSnapshot(`
        {
          "dbo": {
            "name": "dbo",
            "system": false,
          },
          "informationSchema": {
            "name": "INFORMATION_SCHEMA",
            "system": true,
          },
          "sys": {
            "name": "sys",
            "system": true,
          },
        }
      `);
   });
});
