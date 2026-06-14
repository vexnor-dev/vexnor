import { describe, expect, test } from "vitest";
import { VexnorSqlite3 } from "#/vexnor-sqlite3.js";
import { getColumnType } from "#/schema/get-column-type.js";
import { sql } from "#/sqlite3-sql.js";

describe("VexnorSqlite3 plugin class", () => {
   const plugin = new VexnorSqlite3();

   test("name is @vexnor/sqlite3", () => {
      expect(plugin.name).toMatchInlineSnapshot(`"@vexnor/sqlite3"`);
   });

   test("driver is better-sqlite3", () => {
      expect(plugin.driver).toMatchInlineSnapshot(`"better-sqlite3"`);
   });

   test("dialect is sqlite", () => {
      expect(plugin.dialect).toMatchInlineSnapshot(`"sqlite"`);
   });

   test("getLibrary returns empty array", () => {
      expect(plugin.getLibrary()).toMatchInlineSnapshot(`[]`);
   });

   test("newQueryHandler returns a handler with correct pluginName", () => {
      const q = sql`SELECT 1 as id`;
      const handler = plugin.newQueryHandler(q.source);
      expect(handler.pluginName).toMatchInlineSnapshot(`"@vexnor/sqlite3"`);
   });

   test("getColumnType delegates to schema/get-column-type", () => {
      const col = {
         column_default: null,
         column_name: "id",
         is_nullable: "NO" as const,
         is_updatable: "YES" as const,
         table_schema: "main",
         table_name: "test",
         udt_name: "INTEGER",
      };
      const result = plugin.getColumnType(col);
      expect(result).toMatchInlineSnapshot(`
        {
          "type": "number",
        }
      `);
   });
});

describe("sqlite3 getColumnType", () => {
   const base = {
      column_default: null,
      column_name: "col",
      is_nullable: "NO" as const,
      is_updatable: "YES" as const,
      table_schema: "main",
      table_name: "test",
   };

   test("INTEGER => Number", () => {
      expect(getColumnType({ ...base, udt_name: "INTEGER" })).toMatchInlineSnapshot(`
        {
          "type": "number",
        }
      `);
   });

   test("BIGINT => Number", () => {
      expect(getColumnType({ ...base, udt_name: "BIGINT" })).toMatchInlineSnapshot(`
        {
          "type": "number",
        }
      `);
   });

   test("TEXT => String", () => {
      expect(getColumnType({ ...base, udt_name: "TEXT" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("VARCHAR(255) => String", () => {
      expect(getColumnType({ ...base, udt_name: "VARCHAR(255)" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("CHARACTER => String", () => {
      expect(getColumnType({ ...base, udt_name: "CHARACTER" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("REAL => Number", () => {
      expect(getColumnType({ ...base, udt_name: "REAL" })).toMatchInlineSnapshot(`
        {
          "type": "number",
        }
      `);
   });

   test("FLOAT => Number", () => {
      expect(getColumnType({ ...base, udt_name: "FLOAT" })).toMatchInlineSnapshot(`
        {
          "type": "number",
        }
      `);
   });

   test("DOUBLE => Number", () => {
      expect(getColumnType({ ...base, udt_name: "DOUBLE" })).toMatchInlineSnapshot(`
        {
          "type": "number",
        }
      `);
   });

   test("NUMERIC => Number", () => {
      expect(getColumnType({ ...base, udt_name: "NUMERIC" })).toMatchInlineSnapshot(`
        {
          "type": "number",
        }
      `);
   });

   test("DECIMAL => Number", () => {
      expect(getColumnType({ ...base, udt_name: "DECIMAL" })).toMatchInlineSnapshot(`
        {
          "type": "number",
        }
      `);
   });

   test("BLOB => Buffer", () => {
      expect(getColumnType({ ...base, udt_name: "BLOB" })).toMatchInlineSnapshot(`
        {
          "type": "Uint8Array",
        }
      `);
   });

   test("JSON => Json", () => {
      expect(getColumnType({ ...base, udt_name: "JSON" })).toMatchInlineSnapshot(`
        {
          "type": "Json",
        }
      `);
   });

   test("BOOLEAN => Bit", () => {
      expect(getColumnType({ ...base, udt_name: "BOOLEAN" })).toMatchInlineSnapshot(`
        {
          "type": "Bit",
        }
      `);
   });

   test("DATETIME => String", () => {
      expect(getColumnType({ ...base, udt_name: "DATETIME" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("TIMESTAMP => String", () => {
      expect(getColumnType({ ...base, udt_name: "TIMESTAMP" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("unknown type falls back to String", () => {
      expect(getColumnType({ ...base, udt_name: "UNKNOWN_XYZ" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("empty/undefined udt_name falls back to String", () => {
      expect(getColumnType({ ...base, udt_name: undefined })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("empty string udt_name falls back to String", () => {
      expect(getColumnType({ ...base, udt_name: "" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });
});
