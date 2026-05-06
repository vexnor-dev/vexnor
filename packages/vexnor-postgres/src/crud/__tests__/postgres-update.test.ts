import { describe, expect, test } from "vitest";
import { Account } from "vexnor/testing";
import { sql, input } from "vexnor";
import { postgresUpdate } from "#/crud/postgres-update.js";
import { defaultQueryOptions } from "#/default-query-options.js";

describe("postgresUpdate()", () => {
   test("basic update", () => {
      const query = postgresUpdate(Account, {});
      const { text, values } = query.getSql({ params: { set: { email: "new@b.com" } }, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        UPDATE "main"."account"
        /* <query_1> */
        SET
          /* <query_2> */ "email" = $1 /* </query_2> */ /* </query_1> */
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
      const query = postgresUpdate(Account, { WHERE: sql`${Account.$accountId} = ${params.$id}` });
      const { text } = query.getSql({
         params: { set: { email: "new@b.com" }, id: "test-id" },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        UPDATE "main"."account"
        /* <query_1> */
        SET
          /* <query_2> */ "email" = $1 /* </query_2> */ /* </query_1> */
          /* <query_3> */
        WHERE
          /* <query_4> */ "account"."account_id" = $2 /* </query_4> */ /* </query_3> */
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
      const query = postgresUpdate(Account, {});
      expect(query.$$).toBeDefined();
      expect(query.row).toBeDefined();
      expect(query.row.$accountId).toBeDefined();
   });
});
