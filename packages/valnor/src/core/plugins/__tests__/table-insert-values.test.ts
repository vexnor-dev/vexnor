import { describe, expect, test, vi } from "vitest";
import { sql } from "valnor";
import { Account, IAccountSelect } from "../../__tests__/codegen/one_sql.account-table.js";
import { trim } from "../../__tests__/utils.js";

vi.mock("../../random-name.js", () => ({
   randomName: (name: string) => (name === "account" ? "account" : name),
}));

describe("sql plugin table.$$values() tests", () => {
   test("sql() insert with $values()", () => {
      const query = sql<IAccountSelect>`
         insert into ${Account} ${Account.$$values({
            firstName: "Bob",
            lastName: "Smith",
            email: "bob@example.com",
         })}
            returning ${Account.$$all}`;

      expect(query.getValues()).toEqual(["Bob", "Smith", "bob@example.com"]);
      expect(trim(query.getSql())).toBe(
         trim(
            `insert into "one_sql"."account" ("first_name", "account_id", "status", "created_at", "modified_at", "last_name", "notes", "email")
             values (?, default, default, default, default, ?, default, ?)
             returning "account"."first_name" as "firstName", "account"."account_id" as "accountId", "account"."status", "account"."created_at" as "createdAt", "account"."modified_at" as "modifiedAt", "account"."last_name" as "lastName", "account"."notes", "account"."email"`,
         ),
      );
   });
});
