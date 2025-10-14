import { describe, expect, test, vi } from "vitest";
import { Account, IAccountSelect } from "../../__tests__/codegen/one_sql.account-table.js";
import { trim } from "../../utils.js";
import { sql } from "../../sql.js";

vi.mock("../../random.js", () => ({
   randomName: (name: string) => `${name}_1`,
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

      expect(query.getValues({})).toEqual(["Bob", "Smith", "bob@example.com"]);
      expect(trim(query.getSql({}))).toBe(
         trim(
            `insert into "one_sql"."account" as "account_1" ("first_name", "last_name", "email")
             values (?, ?, ?)
             returning "account_1"."first_name" as "firstName", "account_1"."account_id" as "accountId", "account_1"."status", "account_1"."created_at" as "createdAt", "account_1"."modified_at" as "modifiedAt", "account_1"."last_name" as "lastName", "account_1"."notes", "account_1"."email"`,
         ),
      );
   });
});
