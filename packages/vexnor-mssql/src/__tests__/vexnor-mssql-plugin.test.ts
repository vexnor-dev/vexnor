import { describe, expect, test } from "vitest";
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
