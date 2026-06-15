import { describe, expect, test } from "vitest";
import { getColumnType } from "#/schema/get-column-type.js";
import { SqlLiteralType } from "@vexnor/core/plugin";

describe("getColumnType (postgres)", () => {
   test.each([
      ["uuid", SqlLiteralType.String],
      ["text", SqlLiteralType.String],
      ["varchar", SqlLiteralType.String],
      ["bpchar", SqlLiteralType.String],
   ])("%s → String", (udt_name, expected) => {
      expect(getColumnType({ udt_name } as never).type).toBe(expected);
   });

   test.each([["json"], ["jsonb"]])("%s → Json", (udt_name) => {
      expect(getColumnType({ udt_name } as never).type).toBe(SqlLiteralType.Json);
   });

   test.each([["xml"], ["inet"], ["cidr"], ["macaddr"], ["macaddr8"], ["bit"], ["varbit"]])(
      "%s → String",
      (udt_name) => {
         expect(getColumnType({ udt_name } as never).type).toBe(SqlLiteralType.String);
      },
   );

   test("interval → Custom with Interval type", () => {
      expect(getColumnType({ udt_name: "interval" } as never)).toMatchInlineSnapshot(`
        {
          "tsImport": "import type * as vexnorPostgres from "@vexnor/postgres";",
          "tsTypeInsert": "string",
          "tsTypeSelect": "vexnorPostgres.Interval",
          "type": "Custom",
        }
      `);
   });

   test.each([["time"], ["timetz"], ["money"]])("%s → String", (udt_name) => {
      expect(getColumnType({ udt_name } as never).type).toBe(SqlLiteralType.String);
   });

   test("numeric with radix 10 → String", () => {
      expect(getColumnType({ udt_name: "numeric", numeric_precision_radix: 10 } as never).type).toBe(
         SqlLiteralType.String,
      );
   });

   test("numeric without radix 10 → Number", () => {
      expect(getColumnType({ udt_name: "numeric", numeric_precision_radix: 2 } as never).type).toBe(
         SqlLiteralType.Number,
      );
   });

   test.each([["int2"], ["int4"], ["float4"], ["float8"]])("%s → Number", (udt_name) => {
      expect(getColumnType({ udt_name } as never).type).toBe(SqlLiteralType.Number);
   });

   test("int8 → String", () => {
      expect(getColumnType({ udt_name: "int8" } as never).type).toBe(SqlLiteralType.String);
   });

   test("oid → Number", () => {
      expect(getColumnType({ udt_name: "oid" } as never).type).toBe(SqlLiteralType.Number);
   });

   test.each([
      ["xid"],
      ["xid8"],
      ["name"],
      ["pg_lsn"],
      ["tsvector"],
      ["tsquery"],
      ["line"],
      ["lseg"],
      ["box"],
      ["path"],
      ["polygon"],
   ])("%s → String", (udt_name) => {
      expect(getColumnType({ udt_name } as never).type).toBe(SqlLiteralType.String);
   });

   test("point → Custom with Point type", () => {
      expect(getColumnType({ udt_name: "point" } as never)).toMatchInlineSnapshot(`
        {
          "tsImport": "import type * as vexnorPostgres from "@vexnor/postgres";",
          "tsTypeInsert": "string",
          "tsTypeSelect": "vexnorPostgres.Point",
          "type": "Custom",
        }
      `);
   });

   test("circle → Custom with Circle type", () => {
      expect(getColumnType({ udt_name: "circle" } as never)).toMatchInlineSnapshot(`
        {
          "tsImport": "import type * as vexnorPostgres from "@vexnor/postgres";",
          "tsTypeInsert": "string",
          "tsTypeSelect": "vexnorPostgres.Circle",
          "type": "Custom",
        }
      `);
   });

   test("bytea → Buffer", () => {
      expect(getColumnType({ udt_name: "bytea" } as never).type).toBe(SqlLiteralType.Buffer);
   });

   test.each([["date"], ["timestamp"], ["timestamptz"]])("%s → Date", (udt_name) => {
      expect(getColumnType({ udt_name } as never).type).toBe(SqlLiteralType.Date);
   });

   test("bool → Boolean", () => {
      expect(getColumnType({ udt_name: "bool" } as never).type).toBe(SqlLiteralType.Boolean);
   });

   test("USER-DEFINED data_type → Udt", () => {
      const result = getColumnType({ udt_name: "my_enum", data_type: "USER-DEFINED" } as never);
      expect(result.type).toBe(SqlLiteralType.Udt);
      expect((result as { udt: string }).udt).toBe("my_enum");
   });

   test("USER-DEFINED data_type with domain_name fallback → Udt", () => {
      const result = getColumnType({ udt_name: undefined, domain_name: "my_domain", data_type: "USER-DEFINED" } as never);
      expect(result.type).toBe(SqlLiteralType.Udt);
      expect((result as { udt: string }).udt).toBe("my_domain");
   });

   test("unknown udt_name → Unknown", () => {
      expect(getColumnType({ udt_name: "completely_unknown" } as never).type).toBe(SqlLiteralType.Unknown);
   });
});
