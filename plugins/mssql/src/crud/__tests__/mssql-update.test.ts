// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test } from "vitest";
import "@vexnor/mssql";
import { Account } from "@vexnor/core/testing";
import { sql, input } from "@vexnor/core";
import { mssqlUpdate } from "#src/crud/mssql-update.js";
import { defaultQueryOptions } from "#src/default-query-options.js";

describe("mssqlTableUpdate()", () => {
   test("basic update", () => {
      const query = mssqlUpdate(Account, {});
      const { text, values } = query.source.getSql({ params: { set: { email: "new@b.com" } }, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        UPDATE "main"."account"
        SET
          "email" = @param_0 output "inserted"."account_id" AS "accountId",
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
      const { text } = query.source.getSql({
         params: { set: { email: "new@b.com" }, id: "test-id" },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        UPDATE "main"."account"
        SET
          "email" = @param_0 output "inserted"."account_id" AS "accountId",
          "inserted"."status",
          "inserted"."email",
          "inserted"."first_name" AS "firstName",
          "inserted"."last_name" AS "lastName",
          "inserted"."notes",
          "inserted"."created_at" AS "createdAt",
          "inserted"."modified_at" AS "modifiedAt",
          "inserted"."parent_id" AS "parentId"
          /* <query_1> */
        WHERE
          /* <query_2> */ "account"."account_id" = @param_1 /* </query_2> */ /* </query_1> */
          /* </query_0> */"
      `);
   });

   test("has $$ and row", () => {
      const query = mssqlUpdate(Account, {});
      expect(query.source.$$).toBeDefined();
      expect(query.source.row).toBeDefined();
      expect(query.source.row.$accountId).toBeDefined();
   });
});
