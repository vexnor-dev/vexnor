import { describe, expect, test } from "vitest";
import { Account } from "vexnor/testing";
import "vexnor-mssql";
import { defaultQueryOptions } from "#/default-query-options.js";

describe("Account.mssql.findBy()", () => {
   test("single field", () => {
      const query = Account.mssql.findBy();
      const { text, values } = query.getSql({
         params: { email: "a@b.com" },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
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
          /* <query_2> */ "a_1"."email" = @param_0 /* </query_2> */ /* </query_1> */
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "a@b.com",
        ]
      `);
   });

   test("multiple fields", () => {
      const query = Account.mssql.findBy();
      const { text, values } = query.getSql({
         params: { email: "a@b.com", lastName: "Doe" },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
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
          /* <query_2> */ /* <query_3> */ "a_1"."email" = @param_0 /* </query_3> */
          AND /* <query_4> */ "a_1"."last_name" = @param_1 /* </query_4> */ /* </query_2> */ /* </query_1> */
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "a@b.com",
          "Doe",
        ]
      `);
   });
});

describe("Account.mssql.findById()", () => {
   test("by PK", () => {
      const query = Account.mssql.findById();
      const { text, values } = query.getSql({
         params: { accountId: "id-1" },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
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
          /* <query_2> */ "a_1"."account_id" = @param_0 /* </query_2> */ /* </query_1> */
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "id-1",
        ]
      `);
   });
});
