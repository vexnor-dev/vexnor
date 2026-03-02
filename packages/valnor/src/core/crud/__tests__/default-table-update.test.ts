import { describe, expect, test } from "vitest";
import { Account } from "../../__tests__/models/valnor_test.schema.js";
import { sql } from "../../sql.js";
import { param } from "../../query/index.js";
import { SqlTableUpdate } from "../sql-table-update.js";

describe("SqlTableUpdate", () => {
   test("should create instance", () => {
      const update = new SqlTableUpdate(Account);
      expect(update).toBeDefined();
      expect(update.table).toBe(Account);
   });

   test("should generate update query without where clause", () => {
      const update = new SqlTableUpdate(Account);
      const query = update.update({});

      expect(query).toBeDefined();
      const { text } = query.getSql({ params: { set: { email: "new@test.com" } }, options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "valnor_test"."account"
        SET
          /* <query_1> */
          "email" = ?
          /* </query_1> */
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
      const update = new SqlTableUpdate(Account);
      const where = sql`where ${Account.$accountId} = ${param<{ id: string }>("id")}`;
      const query = update.update({ where });

      expect(query).toBeDefined();
      const { text } = query.getSql({
         params: { set: { email: "new@test.com" }, where: { id: "test-id" } },
         options: { dialect: "sqlite" },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "valnor_test"."account"
        SET
          /* <query_1> */
          "email" = ?
          /* </query_1> */
          /* <query_2> */
        WHERE
          "account"."account_id" = ?
          /* </query_2> */
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
      const update = new SqlTableUpdate(Account);
      const query = update.update({});

      const { text } = query.getSql({ params: { set: { email: "new@test.com" } }, options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "valnor_test"."account"
        SET
          /* <query_1> */
          "email" = ?
          /* </query_1> */
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
      const update = new SqlTableUpdate(Account);
      const where = sql`where ${Account.$accountId} = ${"123"}`;
      const query = update.update({ where });

      expect(query).toBeDefined();
      const { text } = query.getSql({ params: { set: { email: "new@test.com" } }, options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "valnor_test"."account"
        SET
          /* <query_1> */
          "email" = ?
          /* </query_1> */
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
