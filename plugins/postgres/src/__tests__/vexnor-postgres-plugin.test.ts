import { describe, expect, test } from "vitest";
import { VexnorPostgres } from "#src/vexnor-postgres.js";
import { getColumnType } from "#src/schema/get-column-type.js";
import { sql } from "#src/postgres-sql.js";

describe("VexnorPostgres plugin class", () => {
   const plugin = new VexnorPostgres();

   test("name is @vexnor/postgres", () => {
      expect(plugin.name).toMatchInlineSnapshot(`"@vexnor/postgres"`);
   });

   test("driver is postgres", () => {
      expect(plugin.driver).toMatchInlineSnapshot(`"postgres"`);
   });

   test("dialect is postgresql", () => {
      expect(plugin.dialect).toMatchInlineSnapshot(`"postgresql"`);
   });

   test("getLibrary returns empty array", () => {
      expect(plugin.getLibrary()).toMatchInlineSnapshot(`[]`);
   });

   test("newQueryHandler returns a handler with correct pluginName", () => {
      const q = sql`SELECT 1 as id`;
      const handler = plugin.newQueryHandler(q.source);
      expect(handler.pluginName).toMatchInlineSnapshot(`"@vexnor/postgres"`);
   });
});

describe("postgres getColumnType", () => {
   const base = {
      column_default: null,
      column_name: "col",
      is_nullable: "NO" as const,
      is_updatable: "YES" as const,
      table_schema: "public",
      table_name: "test",
   };

   test("uuid => String", () => {
      expect(getColumnType({ ...base, udt_name: "uuid" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("text => String", () => {
      expect(getColumnType({ ...base, udt_name: "text" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("varchar => String", () => {
      expect(getColumnType({ ...base, udt_name: "varchar" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("bpchar => String", () => {
      expect(getColumnType({ ...base, udt_name: "bpchar" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("json => Json", () => {
      expect(getColumnType({ ...base, udt_name: "json" })).toMatchInlineSnapshot(`
        {
          "type": "Json",
        }
      `);
   });

   test("jsonb => Json", () => {
      expect(getColumnType({ ...base, udt_name: "jsonb" })).toMatchInlineSnapshot(`
        {
          "type": "Json",
        }
      `);
   });

   test("xml => String", () => {
      expect(getColumnType({ ...base, udt_name: "xml" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("inet => String", () => {
      expect(getColumnType({ ...base, udt_name: "inet" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("cidr => String", () => {
      expect(getColumnType({ ...base, udt_name: "cidr" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("macaddr => String", () => {
      expect(getColumnType({ ...base, udt_name: "macaddr" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("macaddr8 => String", () => {
      expect(getColumnType({ ...base, udt_name: "macaddr8" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("bit => String", () => {
      expect(getColumnType({ ...base, udt_name: "bit" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("varbit => String", () => {
      expect(getColumnType({ ...base, udt_name: "varbit" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("interval => Custom with Interval type", () => {
      expect(getColumnType({ ...base, udt_name: "interval" })).toMatchInlineSnapshot(`
        {
          "tsImport": "import type * as vexnorPostgres from "@vexnor/postgres";",
          "tsTypeInsert": "string",
          "tsTypeSelect": "vexnorPostgres.Interval",
          "type": "Custom",
        }
      `);
   });

   test("time => String", () => {
      expect(getColumnType({ ...base, udt_name: "time" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("timetz => String", () => {
      expect(getColumnType({ ...base, udt_name: "timetz" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("money => String", () => {
      expect(getColumnType({ ...base, udt_name: "money" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("numeric with precision_radix=10 => String", () => {
      expect(getColumnType({ ...base, udt_name: "numeric", numeric_precision_radix: 10 })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("numeric without precision_radix=10 => Number", () => {
      expect(getColumnType({ ...base, udt_name: "numeric", numeric_precision_radix: 2 })).toMatchInlineSnapshot(`
        {
          "type": "number",
        }
      `);
   });

   test("int2 => Number", () => {
      expect(getColumnType({ ...base, udt_name: "int2" })).toMatchInlineSnapshot(`
        {
          "type": "number",
        }
      `);
   });

   test("int4 => Number", () => {
      expect(getColumnType({ ...base, udt_name: "int4" })).toMatchInlineSnapshot(`
        {
          "type": "number",
        }
      `);
   });

   test("float4 => Number", () => {
      expect(getColumnType({ ...base, udt_name: "float4" })).toMatchInlineSnapshot(`
        {
          "type": "number",
        }
      `);
   });

   test("float8 => Number", () => {
      expect(getColumnType({ ...base, udt_name: "float8" })).toMatchInlineSnapshot(`
        {
          "type": "number",
        }
      `);
   });

   test("int8 => String (bigint)", () => {
      expect(getColumnType({ ...base, udt_name: "int8" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("oid => Number", () => {
      expect(getColumnType({ ...base, udt_name: "oid" })).toMatchInlineSnapshot(`
        {
          "type": "number",
        }
      `);
   });

   test("xid => String", () => {
      expect(getColumnType({ ...base, udt_name: "xid" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("xid8 => String", () => {
      expect(getColumnType({ ...base, udt_name: "xid8" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("name => String", () => {
      expect(getColumnType({ ...base, udt_name: "name" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("pg_lsn => String", () => {
      expect(getColumnType({ ...base, udt_name: "pg_lsn" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("tsvector => String", () => {
      expect(getColumnType({ ...base, udt_name: "tsvector" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("tsquery => String", () => {
      expect(getColumnType({ ...base, udt_name: "tsquery" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("line => String", () => {
      expect(getColumnType({ ...base, udt_name: "line" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("lseg => String", () => {
      expect(getColumnType({ ...base, udt_name: "lseg" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("box => String", () => {
      expect(getColumnType({ ...base, udt_name: "box" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("path => String", () => {
      expect(getColumnType({ ...base, udt_name: "path" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("polygon => String", () => {
      expect(getColumnType({ ...base, udt_name: "polygon" })).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `);
   });

   test("point => Custom with Point type", () => {
      expect(getColumnType({ ...base, udt_name: "point" })).toMatchInlineSnapshot(`
        {
          "tsImport": "import type * as vexnorPostgres from "@vexnor/postgres";",
          "tsTypeInsert": "string",
          "tsTypeSelect": "vexnorPostgres.Point",
          "type": "Custom",
        }
      `);
   });

   test("circle => Custom with Circle type", () => {
      expect(getColumnType({ ...base, udt_name: "circle" })).toMatchInlineSnapshot(`
        {
          "tsImport": "import type * as vexnorPostgres from "@vexnor/postgres";",
          "tsTypeInsert": "string",
          "tsTypeSelect": "vexnorPostgres.Circle",
          "type": "Custom",
        }
      `);
   });

   test("bytea => Buffer", () => {
      expect(getColumnType({ ...base, udt_name: "bytea" })).toMatchInlineSnapshot(`
        {
          "type": "Uint8Array",
        }
      `);
   });

   test("date => Date", () => {
      expect(getColumnType({ ...base, udt_name: "date" })).toMatchInlineSnapshot(`
        {
          "type": "Date",
        }
      `);
   });

   test("timestamp => Date", () => {
      expect(getColumnType({ ...base, udt_name: "timestamp" })).toMatchInlineSnapshot(`
        {
          "type": "Date",
        }
      `);
   });

   test("timestamptz => Date", () => {
      expect(getColumnType({ ...base, udt_name: "timestamptz" })).toMatchInlineSnapshot(`
        {
          "type": "Date",
        }
      `);
   });

   test("bool => Boolean", () => {
      expect(getColumnType({ ...base, udt_name: "bool" })).toMatchInlineSnapshot(`
        {
          "type": "boolean",
        }
      `);
   });

   test("USER-DEFINED data_type => Udt", () => {
      expect(getColumnType({ ...base, udt_name: "account_status", data_type: "USER-DEFINED" })).toMatchInlineSnapshot(`
        {
          "type": "Udt",
          "udt": "account_status",
        }
      `);
   });

   test("USER-DEFINED with domain_name fallback", () => {
      expect(getColumnType({ ...base, udt_name: undefined, domain_name: "my_domain", data_type: "USER-DEFINED" })).toMatchInlineSnapshot(`
        {
          "type": "Udt",
          "udt": "my_domain",
        }
      `);
   });

   test("unknown type => Unknown", () => {
      expect(getColumnType({ ...base, udt_name: "unknown_type_xyz" })).toMatchInlineSnapshot(`
        {
          "type": "unknown",
        }
      `);
   });
});
