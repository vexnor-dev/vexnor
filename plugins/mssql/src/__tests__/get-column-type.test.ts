import { describe, expect, test } from "vitest";
import { getColumnType } from "#/get-column-type.js";
import { SqlLiteralType } from "@vexnor/core/plugin";

describe("getColumnType (mssql)", () => {
   test.each([
      ["uniqueidentifier", SqlLiteralType.String],
      ["varchar", SqlLiteralType.String],
      ["nvarchar", SqlLiteralType.String],
      ["char", SqlLiteralType.String],
      ["nchar", SqlLiteralType.String],
      ["text", SqlLiteralType.String],
      ["ntext", SqlLiteralType.String],
      ["xml", SqlLiteralType.String],
      ["json", SqlLiteralType.String],
   ])("%s → String", (udt_name, expected) => {
      expect(getColumnType({ udt_name } as never).type).toBe(expected);
   });

   test.each([
      ["int", SqlLiteralType.Number],
      ["smallint", SqlLiteralType.Number],
      ["tinyint", SqlLiteralType.Number],
      ["decimal", SqlLiteralType.Number],
      ["numeric", SqlLiteralType.Number],
      ["float", SqlLiteralType.Number],
      ["real", SqlLiteralType.Number],
      ["money", SqlLiteralType.Number],
      ["smallmoney", SqlLiteralType.Number],
   ])("%s → Number", (udt_name, expected) => {
      expect(getColumnType({ udt_name } as never).type).toBe(expected);
   });

   test("bigint → String", () => {
      expect(getColumnType({ udt_name: "bigint" } as never).type).toBe(SqlLiteralType.String);
   });

   test.each([["binary"], ["varbinary"], ["image"], ["rowversion"], ["timestamp"]])(
      "%s → Buffer",
      (udt_name) => {
         expect(getColumnType({ udt_name } as never).type).toBe(SqlLiteralType.Buffer);
      },
   );

   test.each([["time"], ["date"], ["datetime"], ["datetime2"], ["smalldatetime"], ["datetimeoffset"]])(
      "%s → Date",
      (udt_name) => {
         expect(getColumnType({ udt_name } as never).type).toBe(SqlLiteralType.Date);
      },
   );

   test("bit → Boolean", () => {
      expect(getColumnType({ udt_name: "bit" } as never).type).toBe(SqlLiteralType.Boolean);
   });

   test("unknown type → Udt", () => {
      const result = getColumnType({ udt_name: "myCustomType" } as never);
      expect(result.type).toBe(SqlLiteralType.Udt);
      expect((result as { udt: string }).udt).toBe("myCustomType");
   });

   test("empty/undefined udt_name → Udt", () => {
      expect(getColumnType({ udt_name: undefined } as never).type).toBe(SqlLiteralType.Udt);
   });
});
