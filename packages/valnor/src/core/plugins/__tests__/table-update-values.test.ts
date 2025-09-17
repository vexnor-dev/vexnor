import { describe, expect, test, vi } from "vitest";
import { param, sql } from "valnor";
import { Account, IAccountSelect } from "../../__tests__/codegen/one_sql.account-table.js";
import { trim } from "../../__tests__/utils.js";

vi.mock("../../random-name.js", () => ({
   randomName: (name: string) => (name === "account" ? "account" : name),
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
         trim`update "one_sql"."account"
              set "first_name"  = ?,
                  "modified_at" = ?,
                  "last_name"   = ?,
                  "email"       = ?
              where "account"."account_id" = ?
              returning "account"."first_name" as "firstName", "account"."account_id" as "accountId", "account"."status", "account"."created_at" as "createdAt", "account"."modified_at" as "modifiedAt", "account"."last_name" as "lastName", "account"."notes", "account"."email"`,
      );
   });
});
