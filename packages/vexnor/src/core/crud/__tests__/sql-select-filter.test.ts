import { describe, expect, test } from "vitest";
import { sql } from "#src/core/sql.js";
import { sqlSelect } from "#src/core/crud/sql-select.js";
import { param } from "#src/core/query/sql-param.js";
import { Account } from "@test-models/vexnor_dev.schema.js";
import { AccountStatusUdt } from "@test-models/vexnor_dev-enums.js";

describe("sqlSelect with filter", () => {
   test("filter only — no user WHERE", () => {
      const query = sqlSelect(Account, {});

      const result = query.getSql({
         params: { filterBy: { email: "jane@example.com", status: AccountStatusUdt.CONFIRMED } },
         options: { dialect: "sqlite" },
      });

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
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("filter with single key", () => {
      const query = sqlSelect(Account, {});

      const result = query.getSql({
         params: { filterBy: { email: "jane@example.com" } },
         options: { dialect: "sqlite" },
      });

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
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("no filter — empty object produces no WHERE", () => {
      const query = sqlSelect(Account, {});

      const result = query.getSql({
         params: { filterBy: {} },
         options: { dialect: "sqlite" },
      });

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
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("no filter — undefined produces no WHERE", () => {
      const query = sqlSelect(Account, {});

      const result = query.getSql({
         params: { filterBy: undefined },
         options: { dialect: "sqlite" },
      });

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
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("filter AND user WHERE compose with AND", () => {
      const query = sqlSelect(Account, {
         WHERE: sql`${Account.$createdAt} > ${param<{ since: string }>("since")}`,
      });

      const result = query.getSql({
         params: { filterBy: { status: AccountStatusUdt.CONFIRMED }, since: "2024-01-01" },
         options: { dialect: "sqlite" },
      });

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
          /* <query_1> */
        WHERE
          /* <query_2> */ "a_1"."created_at" > ? /* </query_2> */ /* </query_1> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`
        [
          "2024-01-01",
        ]
      `);
   });

   test("empty filter with user WHERE — only user WHERE appears", () => {
      const query = sqlSelect(Account, {
         WHERE: sql`${Account.$createdAt} > ${param<{ since: string }>("since")}`,
      });

      const result = query.getSql({
         params: { filterBy: {}, since: "2024-01-01" },
         options: { dialect: "sqlite" },
      });

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
          /* <query_1> */
        WHERE
          /* <query_2> */ "a_1"."created_at" > ? /* </query_2> */ /* </query_1> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`
        [
          "2024-01-01",
        ]
      `);
   });

   test("filter params are discoverable on the query", () => {
      const query = sqlSelect(Account, {});
      expect(query.params).toHaveProperty("filter");
   });

   test("filter skips undefined values within filter object", () => {
      const query = sqlSelect(Account, {});

      const result = query.getSql({
         params: { filterBy: { email: "test@test.com", firstName: undefined, status: AccountStatusUdt.CREATED } },
         options: { dialect: "sqlite" },
      });

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
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });
});
