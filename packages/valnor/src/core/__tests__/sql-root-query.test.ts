import { describe, expect, test, vi } from "vitest";
import { Account, IAccountSelect } from "./codegen/one_sql.schema.js";
import { sql } from "../sql.js";
import { param } from "../query/index.js";
import { trim } from "../utils.js";

vi.mock("../random.js", () => ({
   randomName: (name: string) => `${name}_1`,
}));

describe("sql() tests", () => {
   test("sql() select", () => {
      const names = ["One", "Two", "Three"];
      const query = sql<
         IAccountSelect,
         { names: string[]; email: string }
      >`select ${Account.firstName}, min(${Account.email}), ${Account.email.$$fmt("table.column")} user_email, ${Account.createdAt}
        from ${Account}
        where ${Account.email} = ${param("email")}
          and ${Account.firstName} in (${param("names")})
        group by ${Account.email}`;
      expect(query.getValues({ params: { names, email: "test@example.com" } })).toEqual([
         "test@example.com",
         "One",
         "Two",
         "Three",
      ]);
      expect(trim(query.getSql({ params: { names, email: "test@example.com" } }))).toBe(
         trim(
            `select "account_1"."first_name" as "firstName",
                    min("account_1"."email"),
                    "account_1"."email"         user_email,
                    "account_1"."created_at" as "createdAt"
             from "one_sql"."account" as "account_1"
             where "account_1"."email" = ?
               and "account_1"."first_name" in (?, ?, ?)
             group by "account_1"."email"`,
         ),
      );
   });

   test("sql() without any values", () => {
      const query = sql<IAccountSelect>`select ${Account.firstName}
                                        from ${Account}
                                        where ${Account.email} = 'bob@example.com'`;
      expect(query.getValues({})).toEqual([]);
      expect(trim(query.getSql({}))).toBe(
         trim(
            `select "account_1"."first_name" as "firstName"
             from "one_sql"."account" as "account_1"
             where "account_1"."email" = 'bob@example.com'
            `,
         ),
      );
   });

   test("sql() with value as param", () => {
      const email = "bob@example.com";
      const query = sql<IAccountSelect>`select ${Account.firstName}
                                        from ${Account}
                                        where ${Account.email} = ${email}`;
      expect(query.getValues({})).toEqual(["bob@example.com"]);
      expect(trim(query.getSql({}))).toBe(
         trim(
            `select "account_1"."first_name" as "firstName"
             from "one_sql"."account" as "account_1"
             where "account_1"."email" = ?
            `,
         ),
      );
   });
});
