import { describe, expect, test } from "vitest";
import { Account } from "@test-models/vexnor_dev.schema.js";
import { sql, row } from "@vexnor/core";
import { col } from "#src/core/query/sql-select-column.js";

describe("nextText look-ahead — column alias suppression when followed by expression operators", () => {
   test("column followed by :: (cast) does NOT emit AS alias", () => {
      const query = sql`SELECT ${Account.$accountId}::text AS ${col<{ id: string }>("id")} FROM ${Account}`;
      const { text } = query.getSql({ options: { dialect: "postgresql" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id"::text AS "id"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("column followed by || (concat) does NOT emit AS alias", () => {
      const query = sql`SELECT ${Account.$firstName} || ' ' || ${Account.$lastName} AS ${col<{ fullName: string }>("fullName")} FROM ${Account}`;
      const { text } = query.getSql({ options: { dialect: "postgresql" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."first_name" || ' ' || "a_1"."last_name" AS "fullName"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("column followed by ) does NOT emit AS alias", () => {
      const query = sql`SELECT COALESCE(${Account.$firstName}) FROM ${Account}`;
      const { text } = query.getSql({ options: { dialect: "postgresql" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          COALESCE("a_1"."first_name")
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("column followed by ::int cast does NOT emit AS alias", () => {
      const query = sql`SELECT ${Account.$accountId}::int AS ${col<{ id: number }>("id")} FROM ${Account}`;
      const { text } = query.getSql({ options: { dialect: "postgresql" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id"::int AS "id"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("column NOT followed by operator still emits AS alias", () => {
      const query = sql`SELECT ${Account.$firstName} FROM ${Account}`;
      const { text } = query.getSql({ options: { dialect: "postgresql" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."first_name" AS "firstName"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("column followed by comma still emits AS alias", () => {
      const query = sql`SELECT ${Account.$firstName}, ${Account.$lastName} FROM ${Account}`;
      const { text } = query.getSql({ options: { dialect: "postgresql" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("row() with multiple columns followed by FROM still emits aliases", () => {
      const query = sql`SELECT ${row(Account.$firstName, Account.$lastName)} FROM ${Account}`;
      const { text } = query.getSql({ options: { dialect: "postgresql" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("column followed by :: with whitespace before cast still suppresses alias", () => {
      const query = sql`SELECT ${Account.$accountId} ::text AS ${col<{ id: string }>("id")} FROM ${Account}`;
      const { text } = query.getSql({ options: { dialect: "postgresql" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id"::text AS "id"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("column followed by || with whitespace still suppresses alias", () => {
      const query = sql`SELECT ${Account.$firstName} || ${Account.$lastName} FROM ${Account}`;
      const { text } = query.getSql({ options: { dialect: "postgresql" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."first_name" || "a_1"."last_name"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });
});
