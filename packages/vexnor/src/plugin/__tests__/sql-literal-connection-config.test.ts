import { describe, expect, test } from "vitest";
import { isSqlType, assertIsSqlLiteral, SqlLiteralType } from "#/plugin/sql-literal.js";
import { newConnectionConfig } from "#/plugin/connection-config.js";
import { throwError } from "#/lib/throw-error.js";

describe("isSqlType", () => {
   test("returns true for valid SqlLiteralType values", () => {
      expect(isSqlType("string")).toBe(true);
      expect(isSqlType("Date")).toBe(true);
      expect(isSqlType("BigInt")).toBe(true);
   });

   test("returns false for falsy", () => {
      expect(isSqlType(null)).toBe(false);
      expect(isSqlType("")).toBe(false);
      expect(isSqlType(undefined)).toBe(false);
   });

   test("returns false for non-string", () => {
      expect(isSqlType(42)).toBe(false);
   });

   test("returns false for unknown string", () => {
      expect(isSqlType("nope")).toBe(false);
   });

   test("all enum values are recognised", () => {
      for (const v of Object.values(SqlLiteralType)) {
         expect(isSqlType(v)).toBe(true);
      }
   });
});

describe("assertIsSqlLiteral", () => {
   test("passes for all primitive sql types", () => {
      expect(() => assertIsSqlLiteral("hello")).not.toThrow();
      expect(() => assertIsSqlLiteral(42)).not.toThrow();
      expect(() => assertIsSqlLiteral(true)).not.toThrow();
      expect(() => assertIsSqlLiteral(42n)).not.toThrow();
      expect(() => assertIsSqlLiteral(null)).not.toThrow();
      expect(() => assertIsSqlLiteral(new Date())).not.toThrow();
      expect(() => assertIsSqlLiteral(undefined)).not.toThrow();
   });

   test("throws TypeError for plain object", () => {
      expect(() => assertIsSqlLiteral({ x: 1 })).toThrow(TypeError);
   });

   test("throws TypeError for array", () => {
      expect(() => assertIsSqlLiteral([1, 2])).toThrow(TypeError);
   });
});

describe("newConnectionConfig", () => {
   test("returns uri config", () => {
      expect(newConnectionConfig({ uri: "postgres://localhost/db" })).toMatchInlineSnapshot(`
        {
          "uri": "postgres://localhost/db",
        }
      `);
   });

   test("throws when uri is not a string", () => {
      expect(() => newConnectionConfig({ uri: 123 })).toThrowErrorMatchingInlineSnapshot(
         `[Error: uri must be a string]`,
      );
   });

   test("returns host config when all fields provided", () => {
      expect(
         newConnectionConfig({ host: "localhost", port: 5432, database: "db", user: "u", password: "p" }),
      ).toMatchInlineSnapshot(`
        {
          "database": "db",
          "host": "localhost",
          "password": "p",
          "port": 5432,
          "user": "u",
        }
      `);
   });

   test("throws when host is not a string", () => {
      expect(() =>
         newConnectionConfig({ host: 1, port: 5432, database: "db", user: "u", password: "p" }),
      ).toThrowErrorMatchingInlineSnapshot(`[Error: host must be a string]`);
   });

   test("throws when port is not a number", () => {
      expect(() =>
         newConnectionConfig({ host: "h", port: "5432", database: "db", user: "u", password: "p" }),
      ).toThrowErrorMatchingInlineSnapshot(`[Error: port must be a number]`);
   });

   test("throws when database is not a string", () => {
      expect(() =>
         newConnectionConfig({ host: "h", port: 5432, database: null, user: "u", password: "p" }),
      ).toThrowErrorMatchingInlineSnapshot(`[Error: database must be a string]`);
   });

   test("throws when user is not a string", () => {
      expect(() =>
         newConnectionConfig({ host: "h", port: 5432, database: "db", user: null, password: "p" }),
      ).toThrowErrorMatchingInlineSnapshot(`[Error: user must be a string]`);
   });

   test("throws when password is not a string", () => {
      expect(() =>
         newConnectionConfig({ host: "h", port: 5432, database: "db", user: "u", password: null }),
      ).toThrowErrorMatchingInlineSnapshot(`[Error: password must be a string]`);
   });
});

describe("throwError", () => {
   test("throws the error instance directly", () => {
      const err = new Error("direct");
      expect(() => throwError(err)).toThrow(err);
   });

   test("calls the factory and throws its result", () => {
      const err = new Error("from factory");
      expect(() => throwError(() => err)).toThrow(err);
   });
});
