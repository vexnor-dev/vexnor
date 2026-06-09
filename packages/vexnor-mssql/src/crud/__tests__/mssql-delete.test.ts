// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test } from "vitest";
import { Account } from "vexnor/testing";
import { sql, param } from "vexnor";
import { mssqlDelete } from "#/crud/mssql-delete.js";
import { defaultQueryOptions } from "#/default-query-options.js";

describe("mssqlTableDelete()", () => {
   test("throws without WHERE or force", () => {
      expect(() =>
         mssqlDelete(Account, {
            // @ts-expect-error force must be true
            force: false,
         }),
      ).toThrow();
   });

   test("with force", () => {
      const query = mssqlDelete(Account, { force: true });
      const { text } = query.source.getSql({ options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        DELETE FROM "main"."account" output "deleted"."account_id" AS "accountId",
        "deleted"."status",
        "deleted"."email",
        "deleted"."first_name" AS "firstName",
        "deleted"."last_name" AS "lastName",
        "deleted"."notes",
        "deleted"."created_at" AS "createdAt",
        "deleted"."modified_at" AS "modifiedAt",
        "deleted"."parent_id" AS "parentId"
        /* </query_0> */"
      `);
   });

   test("with WHERE", () => {
      const id = param<{ id: string }>("id");
      const query = mssqlDelete(Account, { WHERE: sql`${Account.$accountId} = ${id}` });
      const { text } = query.source.getSql({ params: { id: "test-id" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        DELETE FROM "main"."account" output "deleted"."account_id" AS "accountId",
        "deleted"."status",
        "deleted"."email",
        "deleted"."first_name" AS "firstName",
        "deleted"."last_name" AS "lastName",
        "deleted"."notes",
        "deleted"."created_at" AS "createdAt",
        "deleted"."modified_at" AS "modifiedAt",
        "deleted"."parent_id" AS "parentId"
        /* <query_1> */
        WHERE
          /* <query_2> */ "account"."account_id" = ? /* </query_2> */ /* </query_1> */
          /* </query_0> */"
      `);
   });

   test("has $$ and row", () => {
      const query = mssqlDelete(Account, { force: true });
      expect(query.source.$$).toBeDefined();
      expect(query.source.row).toBeDefined();
      expect(query.source.row.$accountId).toBeDefined();
   });
});
