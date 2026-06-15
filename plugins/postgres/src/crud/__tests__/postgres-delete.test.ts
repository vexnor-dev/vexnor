// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test } from "vitest";
import { Account } from "@vexnor/core/testing";
import { sql, param } from "@vexnor/core";
import { postgresDelete } from "#/crud/postgres-delete.js";
import { defaultQueryOptions } from "#/default-query-options.js";

describe("postgresDelete()", () => {
   test("throws without WHERE or force", () => {
      expect(() =>
         postgresDelete(Account, {
            // @ts-expect-error force must be true
            force: false,
         }),
      ).toThrow();
   });

   test("with force", () => {
      const deleteAccount = postgresDelete(Account, { force: true });
      const { text } = deleteAccount.source.getSql({ options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        DELETE FROM "main"."account"
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */"
      `);
   });

   test("with WHERE", () => {
      const id = param<{ id: string }>("id");
      const deleteAccount = postgresDelete(Account, { WHERE: sql`${Account.$accountId} = ${id}` });
      const { text } = deleteAccount.source.getSql({ params: { id: "test-id" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        DELETE FROM "main"."account"
        /* <query_1> */
        WHERE
          /* <query_2> */ "account"."account_id" = ? /* </query_2> */ /* </query_1> */ returning "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */"
      `);
   });

   test("has $$ and row", () => {
      const deleteAccount = postgresDelete(Account, { force: true });
      expect(deleteAccount.source.$$).toBeDefined();
      expect(deleteAccount.source.row).toBeDefined();
      expect(deleteAccount.source.row.$accountId).toBeDefined();
   });
});
