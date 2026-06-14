import { describe, expect, test } from "vitest";
import { getColumnType } from "#/schema/get-column-type.js";
import { SqlLiteralType } from "vexnor/plugin";

describe("getColumnType (sqlite3)", () => {
   test.each([
      ["integer", SqlLiteralType.Number],
      ["int", SqlLiteralType.Number],
      ["bigint", SqlLiteralType.Number],
      ["tinyint", SqlLiteralType.Number],
   ])("%s → Number", (udt_name, expected) => {
      expect(getColumnType({ udt_name } as never).type).toBe(expected);
   });

   test.each([
      ["text", SqlLiteralType.String],
      ["varchar", SqlLiteralType.String],
      ["char", SqlLiteralType.String],
      ["nvarchar", SqlLiteralType.String],
   ])("%s → String", (udt_name, expected) => {
      expect(getColumnType({ udt_name } as never).type).toBe(expected);
   });

   test.each([
      ["real", SqlLiteralType.Number],
      ["float", SqlLiteralType.Number],
      ["double", SqlLiteralType.Number],
   ])("%s → Number", (udt_name, expected) => {
      expect(getColumnType({ udt_name } as never).type).toBe(expected);
   });

   test.each([
      ["numeric", SqlLiteralType.Number],
      ["decimal", SqlLiteralType.Number],
   ])("%s → Number", (udt_name, expected) => {
      expect(getColumnType({ udt_name } as never).type).toBe(expected);
   });

   test("blob → Buffer", () => {
      expect(getColumnType({ udt_name: "blob" } as never).type).toBe(SqlLiteralType.Buffer);
   });

   test("json → Json", () => {
      expect(getColumnType({ udt_name: "json" } as never).type).toBe(SqlLiteralType.Json);
   });

   test("boolean → Bit", () => {
      expect(getColumnType({ udt_name: "boolean" } as never).type).toBe(SqlLiteralType.Bit);
   });

   test.each([["date", SqlLiteralType.String], ["datetime", SqlLiteralType.String], ["time", SqlLiteralType.String]])(
      "%s → String",
      (udt_name, expected) => {
         expect(getColumnType({ udt_name } as never).type).toBe(expected);
      },
   );

   test("unknown type → String (default)", () => {
      expect(getColumnType({ udt_name: "unknowntype" } as never).type).toBe(SqlLiteralType.String);
   });

   test("empty udt_name → String (default)", () => {
      expect(getColumnType({ udt_name: "" } as never).type).toBe(SqlLiteralType.String);
   });

   test("undefined udt_name → String (default)", () => {
      expect(getColumnType({ udt_name: undefined } as never).type).toBe(SqlLiteralType.String);
   });
});
