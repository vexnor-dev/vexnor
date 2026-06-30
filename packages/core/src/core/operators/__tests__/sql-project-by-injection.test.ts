import { describe, expect, test } from "vitest";
import { sqlSelect } from "#src/core/crud/sql-select.js";
import { Account } from "@test-models/vexnor_dev.schema.js";

function buildWithSelect(selectData: unknown, dialect: "sqlite" | "postgresql" | "transactsql" = "sqlite") {
   const query = sqlSelect(Account, {});
   return query.getSql({ params: { select: selectData as never }, options: { dialect } });
}

describe("SqlProjectBy — injection vectors (now blocked)", () => {
   describe("P0: dateTrunc granularity validated for all dialects", () => {
      test("malicious granularity in PostgreSQL throws", () => {
         expect(() =>
            buildWithSelect(
               { p: { fn: "dateTrunc", col: "createdAt", args: "year'); DROP TABLE users; --" } },
               "postgresql",
            ),
         ).toThrow("Invalid dateTrunc granularity");
      });

      test("malicious granularity in MSSQL throws", () => {
         expect(() =>
            buildWithSelect(
               { p: { fn: "dateTrunc", col: "createdAt", args: "year); DROP TABLE users; --" } },
               "transactsql",
            ),
         ).toThrow("Invalid dateTrunc granularity");
      });

      test("SQLite also rejects invalid granularity with unified message", () => {
         expect(() =>
            buildWithSelect(
               { p: { fn: "dateTrunc", col: "createdAt", args: "year'); DROP TABLE x; --" } },
               "sqlite",
            ),
         ).toThrow("Invalid dateTrunc granularity");
      });
   });

   describe("P0: round precision validated as number", () => {
      test("string precision throws", () => {
         expect(() =>
            buildWithSelect(
               { r: { fn: "round", col: "createdAt", args: ["2); DROP TABLE users; --"] } },
               "sqlite",
            ),
         ).toThrow("Invalid round precision");
      });

      test("non-numeric precision throws", () => {
         expect(() =>
            buildWithSelect(
               { r: { fn: "round", col: "createdAt", args: ["abc"] } },
               "postgresql",
            ),
         ).toThrow("Invalid round precision");
      });
   });

   describe("P0: renderLiteral now parameterized — values in params array, not SQL text", () => {
      test("coalesce string arg is parameterized", () => {
         const { text, values } = buildWithSelect(
            { c: { fn: "coalesce", col: "notes", args: "default_value" } },
            "sqlite",
         );
         // Value is now in the parameterized values array, not embedded in SQL
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             coalesce("a_1"."notes", ?) AS "c"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "default_value",
           ]
         `);
      });

      test("concat args are parameterized", () => {
         const { text, values } = buildWithSelect(
            { c: { fn: "concat", col: "firstName", args: [" ", "lastName"] } },
            "postgresql",
         );
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."first_name" || $1 || $2 AS "c"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             " ",
             "lastName",
           ]
         `);
      });

      test("coalesce with injection attempt — safely parameterized", () => {
         const { text, values } = buildWithSelect(
            { c: { fn: "coalesce", col: "notes", args: "\\'); DROP TABLE users; --" } },
            "postgresql",
         );
         // Injection string is in values array as a safe parameter
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             coalesce("a_1"."notes", $1) AS "c"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "\\'); DROP TABLE users; --",
           ]
         `);
      });
   });
});
