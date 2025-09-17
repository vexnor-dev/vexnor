import { describe, expect, test, vi } from "vitest";
import { param, sql } from "valnor";
import { Account, IAccountSelect } from "../../__tests__/codegen/one_sql.account-table.js";
import { trim } from "../../utils.js";

vi.mock("../../random-name.js", () => ({
   randomName: (name: string) => `${name}_1`,
}));

describe("sql plugin: table.$$set tests", () => {
   test("sql() update with $set()", () => {
      const modifiedAt = new Date();
      const query = sql<IAccountSelect, { accountId: string }>`
         update ${Account}
         set ${Account.$$set({
            firstName: "Bob",
            lastName: "Smith",
            email: "bob@example.com",
            modifiedAt,
         })}
         where ${Account.accountId} = ${param("accountId")}
         returning ${Account.$$all}`;
      expect(query.getValues({ accountId: "123e4567-e89b-12d3-a456-426614174000" })).toEqual([
         "Bob",
         modifiedAt,
         "Smith",
         "bob@example.com",
         "123e4567-e89b-12d3-a456-426614174000",
      ]);
      expect(trim(query.getSql({ accountId: "123e4567-e89b-12d3-a456-426614174000" }))).toBe(
         trim`update "one_sql"."account" as "account_1"
              set "first_name"  = ?,
                  "modified_at" = ?,
                  "last_name"   = ?,
                  "email"       = ?
              where "account_1"."account_id" = ?
              returning "account_1"."first_name" as "firstName", "account_1"."account_id" as "accountId", "account_1"."status", "account_1"."created_at" as "createdAt", "account_1"."modified_at" as "modifiedAt", "account_1"."last_name" as "lastName", "account_1"."notes", "account_1"."email"`,
      );
   });
});
