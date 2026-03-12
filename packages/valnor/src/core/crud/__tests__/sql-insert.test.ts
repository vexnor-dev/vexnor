import { describe, expect, test } from "vitest";
import { Account } from "@test-models/valnor_test.schema.js";
import { sql } from "#/core/sql.js";
import { sqlInsertRows } from "#/core/crud/sql-insert-rows.js";
import { row } from "#/core/query/sql-select-row.js";
import { sqlInsertFrom } from "#/core/crud/sql-insert-from.js";

describe("SqlTableCreate", () => {
   test("should generate insert query without from clause", () => {
      const query = sqlInsertRows(Account);

      expect(query).toBeDefined();
      const { text } = query.getSql({
         params: { rows: [{ email: "test@test.com", firstName: "John", lastName: "Doe" }] },
         options: { dialect: "sqlite" },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "main"."account" ("email", "first_name", "last_name")
        VALUES
          /* <query_1> */
          (?, ?, ?) /* </query_1> */
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

   test("should generate insert query with from subquery", () => {
      const query = sqlInsertFrom(Account, {
         FROM: sql`select ${row(Account.$$)} from ${Account} where ${Account.$status} = 'active'`,
      });

      expect(query).toBeDefined();
      const { text } = query.getSql({
         options: { dialect: "sqlite" },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "main"."account"
          /* <query_1> */
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
        WHERE
          "a_1"."status" = 'active' /* </query_1> */
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

   test("should handle expand columns correctly", () => {
      const query = sqlInsertRows(Account);

      const { text } = query.getSql({
         params: { rows: [{ email: "test@test.com", firstName: "John", lastName: "Doe" }] },
         options: { dialect: "sqlite" },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "main"."account" ("email", "first_name", "last_name")
        VALUES
          /* <query_1> */
          (?, ?, ?) /* </query_1> */
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
