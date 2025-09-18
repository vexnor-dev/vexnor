import { describe, expect, test, vi } from "vitest";

vi.mock(import("../random-name.js"), () => {
   return {
      randomName: (name: string) => `${name}_1`,
   };
});

import { Account } from "./codegen/one_sql.account-table.js";
import { param, sql } from "valnor";
import { trim } from "../utils.js";

describe("sql() tests", () => {
   test("sql() select", () => {
      const names = ["One", "Two", "Three"];
      type Row = {
         firstName: string;
         email: string;
         user_email: string;
         createdAt: Date;
      };
      const query = sql<
         Row,
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
});
