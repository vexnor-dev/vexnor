import { describe, expect, test } from "vitest";
import { params } from "#/core/query/sql-params-list.js";
import { sql, row } from "#/core/core.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";

describe("params()", () => {
   test("creates typed SqlParam instances from property access", () => {
      const p = params<{ name: string; age: number }>();
      expect(p.name.name).toMatchInlineSnapshot(`"name"`);
      expect(p.age.name).toMatchInlineSnapshot(`"age"`);
   });

   test("returns cached instance on repeated access", () => {
      const p = params<{ email: string }>();
      const first = p.email;
      const second = p.email;
      expect(first).toBe(second);
   });

   test("attaches validation rules when provided", () => {
      const p = params<{ name: string; score: number }>({
         name: { minLength: 1, maxLength: 100 },
         score: { min: 0, max: 100 },
      });

      expect(p.name.validation).toMatchInlineSnapshot(`
        {
          "maxLength": 100,
          "minLength": 1,
        }
      `);
      expect(p.score.validation).toMatchInlineSnapshot(`
        {
          "max": 100,
          "min": 0,
        }
      `);
   });

   test("params without validation have null validation", () => {
      const p = params<{ name: string; age: number }>({ name: { minLength: 1 } });
      expect(p.age.validation).toMatchInlineSnapshot(`null`);
   });

   test("works with no validation argument", () => {
      const p = params<{ id: string }>();
      expect(p.id.name).toMatchInlineSnapshot(`"id"`);
      expect(p.id.validation).toMatchInlineSnapshot(`null`);
   });

   test("proxy has() returns true for any key", () => {
      const p = params<{ x: string }>();
      expect("x" in p).toMatchInlineSnapshot(`true`);
      expect("anything" in p).toMatchInlineSnapshot(`true`);
   });

   test("works in a real sql query — produces correct SQL and values", () => {
      const p = params<{ email: string }>();

      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${Account.$email} = ${p.email}
      `;

      const { text, values } = query.getSql({ params: { email: "test@example.com" } });
      expect(values).toMatchInlineSnapshot(`
        [
          "test@example.com",
        ]
      `);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1"
        WHERE
          "a_1"."email" = ?
          /* </query_0> */"
      `);
   });

   test("works with multiple params in same query", () => {
      const p = params<{ firstName: string; lastName: string }>();

      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${Account.$firstName} = ${p.firstName}
           AND ${Account.$lastName} = ${p.lastName}
      `;

      const { values } = query.getSql({ params: { firstName: "Jane", lastName: "Doe" } });
      expect(values).toMatchInlineSnapshot(`
        [
          "Jane",
          "Doe",
        ]
      `);
   });

   test("same param used multiple times in query produces correct placeholders", () => {
      const p = params<{ search: string }>();

      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${Account.$firstName} = ${p.search}
            OR ${Account.$lastName} = ${p.search}
      `;

      const { text, values } = query.getSql({ params: { search: "test" } });
      expect(values).toMatchInlineSnapshot(`
        [
          "test",
          "test",
        ]
      `);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1"
        WHERE
          "a_1"."first_name" = ?
          OR "a_1"."last_name" = ?
          /* </query_0> */"
      `);
   });

   test("works with validation and default value", () => {
      const p = params<{ limit: number }>({
         limit: { min: 1, max: 100, default: 10 },
      });

      expect(p.limit.hasDefault).toMatchInlineSnapshot(`true`);
      expect(p.limit.default).toMatchInlineSnapshot(`10`);
   });
});
