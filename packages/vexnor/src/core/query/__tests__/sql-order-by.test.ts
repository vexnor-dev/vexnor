import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { orderBy, SqlOrderBy } from "#/core/query/sql-order-by.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.schema.js";

describe("SqlOrderBy", () => {
   test("single column ASC", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         ${orderBy(Account)}
      `;
      const result = query.getSql({ params: { orderBy: { createdAt: "ASC" } } });
      expect(result.text).toMatchInlineSnapshot(`
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
        ORDER BY
          "a_1"."created_at" ASC
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("single column DESC", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         ${orderBy(Account)}
      `;
      const result = query.getSql({ params: { orderBy: { email: "DESC" } } });
      expect(result.text).toMatchInlineSnapshot(`
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
        ORDER BY
          "a_1"."email" DESC
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("multiple columns — key order determines priority", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         ${orderBy(Account)}
      `;
      const result = query.getSql({ params: { orderBy: { status: "ASC", createdAt: "DESC" } } });
      expect(result.text).toMatchInlineSnapshot(`
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
        ORDER BY
          "a_1"."status" ASC,
          "a_1"."created_at" DESC
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("no output when orderBy is null", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         ${orderBy(Account)}
      `;
      const result = query.getSql({ params: { orderBy: null } });
      expect(result.text).toMatchInlineSnapshot(`
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
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("no output when orderBy is undefined (omitted)", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         ${orderBy(Account)}
      `;
      const result = query.getSql({ params: { orderBy: undefined } });
      expect(result.text).toMatchInlineSnapshot(`
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
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("no output when orderBy is empty object", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         ${orderBy(Account)}
      `;
      const result = query.getSql({ params: { orderBy: {} } });
      expect(result.text).toMatchInlineSnapshot(`
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
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("throws on unknown column", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         ${orderBy(Account)}
      `;
      // @ts-expect-error column not found
      expect(() => query.getSql({ params: { orderBy: { badCol: "ASC" } } })).toThrow(
         "Column not found for orderBy: badCol",
      );
   });

   test("throws on invalid direction", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         ${orderBy(Account)}
      `;
      // @ts-expect-error invalid dir ASC|DESC
      expect(() => query.getSql({ params: { orderBy: { email: "INVALID" } } })).toThrow("Invalid order direction");
   });

   test("custom param name", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         ${new SqlOrderBy(Account, { paramName: "sort" })}
      `;
      const result = query.getSql({ params: { sort: { email: "ASC" } } });
      expect(result.text).toMatchInlineSnapshot(`
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
        ORDER BY
          "a_1"."email" ASC
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("lowercase directions work", () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         ${orderBy(Account)}
      `;
      const result = query.getSql({ params: { orderBy: { email: "desc", createdAt: "asc" } } });
      expect(result.text).toMatchInlineSnapshot(`
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
        ORDER BY
          "a_1"."email" DESC,
          "a_1"."created_at" ASC
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });
});
