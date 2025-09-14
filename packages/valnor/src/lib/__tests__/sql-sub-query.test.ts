import { describe, expect, test, vi } from "vitest";
import { Account, IAccountSelect } from "./codegen/pg/one_sql.account-table.js";
import { info, param, sql } from "valnor";
import { trim } from "./utils.js";

vi.mock("../random-name.js", () => ({
   randomName: (name: string) => (name === "account" ? "account_1" : `${name}_1`),
}));

describe("sql subqueries tests", () => {
   test("sub-query from", () => {
      const AccountsWithEmail = sql<IAccountSelect, { email: string }>`
         ${info({ label: "AccountsWithEmail" })}
         select ${Account.$$all}
         from ${Account}
         where ${Account.email} = ${param("email")}`;

      const query = sql<IAccountSelect, { firstName: string; email: string }>`
         select ${AccountsWithEmail.ROW.$$all}
         from (${AccountsWithEmail})
         where ${AccountsWithEmail.ROW.firstName} = ${param("firstName")}`;

      query.buildCache();
      expect(query.values({ firstName: "John", email: "test@example.com" })).toEqual(["test@example.com", "John"]);
      expect(trim(query.sql({ firstName: "John", email: "test@example.com" }))).toBe(trim`select "AccountsWithEmail".*
                                                                     from (( /* --label: AccountsWithEmail */ select "account_1"."first_name"    as "firstName",
                                                                                                               "account_1"."account_id" as "accountId",
                                                                                                               "account_1"."status",
                                                                                                               "account_1"."created_at" as "createdAt",
                                                                                                               "account_1"."modified_at" as "modifiedAt",
                                                                                                               "account_1"."last_name" as "lastName",
                                                                                                               "account_1"."notes",
                                                                                                               "account_1"."email"
                                                                                                        from "one_sql"."account" as "account_1"
                                                                                                        where "account_1"."email" = ?) as "AccountsWithEmail")
                                                                     where "AccountsWithEmail"."firstName" = ?`);
   });

   test("sub-query join", () => {
      const AccountsWithEmail = sql<IAccountSelect, { email: string }>`
         ${info({ label: "AccountsWithEmail" })}
         select ${Account.$$all}
         from ${Account}
         where ${Account.email} = ${param("email")}
      `;

      const query = sql<IAccountSelect, { firstName: string; email: string }>`select ${Account.$$all}
                                                                     from ${Account}
                                                                             join (${AccountsWithEmail}) on ${Account.accountId} = ${AccountsWithEmail.ROW.accountId}
                                                                     where ${Account.firstName} = ${param("firstName")}`;

      expect(query.values({ firstName: "John", email: "test@example.com" })).toEqual(["test@example.com", "John"]);
      expect(trim(query.sql({ firstName: "John", email: "test@example.com" })))
         .toBe(trim`select "account_1"."first_name" as "firstName",
                                                                            "account_1"."account_id" as "accountId",
                                                                            "account_1"."status",
                                                                            "account_1"."created_at" as "createdAt",
                                                                            "account_1"."modified_at" as "modifiedAt",
                                                                            "account_1"."last_name" as "lastName",
                                                                            "account_1"."notes",
                                                                            "account_1"."email"
                                                                     from "one_sql"."account" as "account_1"
                                                                             join ((
                                                                        /* --label: AccountsWithEmail */
                                                                        select "account_1"."first_name"  as  "firstName",
                                                                               "account_1"."account_id" as "accountId",
                                                                               "account_1"."status",
                                                                               "account_1"."created_at" as "createdAt",
                                                                               "account_1"."modified_at" as "modifiedAt",
                                                                               "account_1"."last_name" as "lastName",
                                                                               "account_1"."notes",
                                                                               "account_1"."email"
                                                                        from "one_sql"."account" as "account_1"
                                                                        where "account_1"."email" = ?) as "AccountsWithEmail")
                                                                     on "account_1"."account_id" = "AccountsWithEmail"."accountId"
                                                                     where "account_1"."first_name" = ?`);
   });
});
