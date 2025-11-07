import { describe, expect, test } from "vitest";
import { Account, IAccountSelect } from "@test-models/valnor_test.account-table.js";
import { sql } from "../../sql.js";
import { param, rowType } from "../../query/index.js";

describe("sql plugin: table.$$set tests", () => {
   test("sql() update with $set()", () => {
      const modifiedAt = new Date();
      const query = sql`
        ${rowType<IAccountSelect>()}
         update ${Account}
         set ${Account.$set({
            firstName: "Bob",
            lastName: "Smith",
            email: "bob@example.com",
            modifiedAt,
         })}
         where ${Account.accountId} = ${param("accountId").is<string>()}
         returning ${Account.$all}`;
      expect(query.getValues({ params: { accountId: "123e4567-e89b-12d3-a456-426614174000" } })).toEqual([
         "Bob",
         "Smith",
         "bob@example.com",
         modifiedAt,
         "123e4567-e89b-12d3-a456-426614174000",
      ]);
      expect(query.getSql({ params: { accountId: "123e4567-e89b-12d3-a456-426614174000" } })).toEqualQuery(
         `update "valnor_test"."account"
          set "first_name" = ?,
              "last_name" = ?,
              "email" = ?,
              "modified_at" = ?
          where "account"."account_id" = ?
          returning "account"."account_id" as "accountId", "account"."status", "account"."email", "account"."first_name" as "firstName", "account"."last_name" as "lastName", "account"."notes", "account"."created_at" as "createdAt", "account"."modified_at" as "modifiedAt", "account"."parent_id" as "parentId"`,
      );
   });
});
