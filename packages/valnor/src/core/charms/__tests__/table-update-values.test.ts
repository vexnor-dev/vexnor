import { describe, expect, test } from "vitest";
import { Account } from "@test-models/valnor_test.account-table.js";
import { sql } from "#/core/sql.js";
import { param } from "#/core/query/sql-param.js";
import { row } from "#/core/query/sql-select-row.js";

describe("SqlTable.updateSet() tests", () => {
   test("sql() update with $set()", () => {
      const modifiedAt = new Date();
      const query = sql`
         update ${Account}
         set ${Account.updateSet({
            firstName: "Bob",
            lastName: "Smith",
            email: "bob@example.com",
            modifiedAt,
         })}
         where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
         returning ${row(Account.$$)}`;
      const { values, text } = query.getSql({ params: { accountId: "123e4567-e89b-12d3-a456-426614174000" } });
      expect(values).toEqual(["Bob", "Smith", "bob@example.com", modifiedAt, "123e4567-e89b-12d3-a456-426614174000"]);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "main"."account"
        SET
          "first_name" = ?,
          "last_name" = ?,
          "email" = ?,
          "modified_at" = ?
        WHERE
          "account"."account_id" = ? returning "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId" /* </query_0> */"
      `);
   });
});
