import { assertType, describe, expect, test } from "vitest";
import { Account, IAccountSelect, IAccountUpdate } from "@test-models/valnor_test.schema.js";
import { sql } from "#/core/sql.js";
import { input } from "#/core/query/sql-input.js";
import { sqlUpdate } from "#/core/crud/sql-update.js";
import { SqlQuery } from "#/core/query/sql-query.js";

describe("SqlTableUpdate", () => {
   test("should generate update query without where clause", () => {
      const query = sqlUpdate(Account, {});

      expect(query).toBeDefined();
      assertType<SqlQuery<{ Row: IAccountSelect; Params: { set: IAccountUpdate } }>>(query);
      const { text } = query.getSql({ params: { set: { email: "new@test.com" } }, options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "main"."account"
        /* <query_1> */
        SET
          /* <query_2> */ "email" = ? /* </query_2> */ /* </query_1> */
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

   test("should generate update query with where clause", () => {
      const params = input<{ id: string }>();
      const query = sqlUpdate(Account, {
         WHERE: sql`${Account.$accountId} = ${params.$id}`,
      });

      expect(query).toBeDefined();
      const { text } = query.getSql({
         params: { set: { email: "new@test.com" }, id: "test-id" },
         options: { dialect: "sqlite" },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "main"."account"
        /* <query_1> */
        SET
          /* <query_2> */ "email" = ? /* </query_2> */ /* </query_1> */
          /* <query_3> */
        WHERE
          /* <query_4> */
          "account"."account_id" = ? /* </query_4> */ /* </query_3> */
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

   test("should handle expand set clause", () => {
      const query = sqlUpdate(Account, {});

      const { text } = query.getSql({ params: { set: { email: "new@test.com" } }, options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "main"."account"
        /* <query_1> */
        SET
          /* <query_2> */ "email" = ? /* </query_2> */ /* </query_1> */
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

   test("should generate update query with where clause - no params", () => {
      const where = sql`${Account.$accountId} = ${"123"}`;
      const query = sqlUpdate(Account, { WHERE: where });

      expect(query).toBeDefined();
      const { text } = query.getSql({ params: { set: { email: "new@test.com" } }, options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "main"."account"
        /* <query_1> */
        SET
          /* <query_2> */ "email" = ? /* </query_2> */ /* </query_1> */
          /* <query_3> */
        WHERE
          /* <query_4> */
          "account"."account_id" = ? /* </query_4> */ /* </query_3> */
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
});
