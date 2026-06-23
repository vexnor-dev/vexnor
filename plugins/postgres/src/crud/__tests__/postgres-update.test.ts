// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test } from "vitest";
import { Account } from "@vexnor/core/testing";
import { sql, input } from "@vexnor/core";
import { postgresUpdate } from "#/crud/postgres-update.js";
import { defaultQueryOptions } from "#/default-query-options.js";

describe("postgresUpdate()", () => {
   test("basic update", () => {
      const query = postgresUpdate(Account, {});
      const { text, values } = query.source.getSql({
         params: { set: { email: "new@b.com" } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        UPDATE "main"."account"
        SET
          "email" = $1
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
      expect(values).toMatchObject(["new@b.com"]);
   });

   test("with WHERE", () => {
      const params = input<{ id: string }>();
      const update = postgresUpdate(Account, { WHERE: sql`${Account.$accountId} = ${params.$id}` });
      const { text } = update.source.getSql({
         params: { set: { email: "new@b.com" }, id: "test-id" },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        UPDATE "main"."account"
        SET
          "email" = $1
          /* <query_1> */
        WHERE
          /* <query_2> */ "account"."account_id" = $2 /* </query_2> */ /* </query_1> */
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

   test("has $$ and row", () => {
      const update = postgresUpdate(Account, {});
      expect(update.source.$$).toBeDefined();
      expect(update.source.row).toBeDefined();
      expect(update.source.row.$accountId).toBeDefined();
   });
});
