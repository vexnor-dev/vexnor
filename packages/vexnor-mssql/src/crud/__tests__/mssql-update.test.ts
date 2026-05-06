import { describe, expect, test } from "vitest";
import { Account } from "vexnor/testing";
import { sql, input } from "vexnor";
import { mssqlUpdate } from "#/crud/mssql-update.js";
import { defaultQueryOptions } from "#/default-query-options.js";

describe("mssqlTableUpdate()", () => {
   test("basic update", () => {
      const query = mssqlUpdate(Account, {});
      const { text, values } = query.getSql({ params: { set: { email: "new@b.com" } }, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        UPDATE "main"."account"
        /* <query_1> */
        SET
          /* <query_2> */ "email" = @param_0 /* </query_2> */ /* </query_1> */ output "inserted"."account_id" AS "accountId",
          "inserted"."status",
          "inserted"."email",
          "inserted"."first_name" AS "firstName",
          "inserted"."last_name" AS "lastName",
          "inserted"."notes",
          "inserted"."created_at" AS "createdAt",
          "inserted"."modified_at" AS "modifiedAt",
          "inserted"."parent_id" AS "parentId"
          /* </query_0> */"
      `);
      expect(values).toMatchObject(["new@b.com"]);
   });

   test("with WHERE", () => {
      const params = input<{ id: string }>();
      const query = mssqlUpdate(Account, { WHERE: sql`${Account.$accountId} = ${params.$id}` });
      const { text } = query.getSql({
         params: { set: { email: "new@b.com" }, id: "test-id" },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        UPDATE "main"."account"
        /* <query_1> */
        SET
          /* <query_2> */ "email" = @param_0 /* </query_2> */ /* </query_1> */ output "inserted"."account_id" AS "accountId",
          "inserted"."status",
          "inserted"."email",
          "inserted"."first_name" AS "firstName",
          "inserted"."last_name" AS "lastName",
          "inserted"."notes",
          "inserted"."created_at" AS "createdAt",
          "inserted"."modified_at" AS "modifiedAt",
          "inserted"."parent_id" AS "parentId"
          /* <query_3> */
        WHERE
          /* <query_4> */ "account"."account_id" = @param_1 /* </query_4> */ /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("has $$ and row", () => {
      const query = mssqlUpdate(Account, {});
      expect(query.$$).toBeDefined();
      expect(query.row).toBeDefined();
      expect(query.row.$accountId).toBeDefined();
   });
});
