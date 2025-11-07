import { describe, expect, test } from "vitest";
import { row, sql } from "valnor";
import { Account, IAccountInsert } from "./codegen/valnor_test.account-table.js";
import "@valnor/test-utils";

describe("SqlTable.$$values() tests", () => {
   test("sql() insert with $values()", () => {
      const rows: IAccountInsert[] = [
         {
            firstName: "John1",
            lastName: "Doe1",
            email: "john1.doe1@example.com",
         },
         {
            firstName: "John2",
            lastName: "Doe2",
            email: "john2.doe2@example.com",
         },
      ];
      const query = sql`
         insert into ${Account}
            ${Account.$$values(...rows)}
            returning ${row(Account.$$all)}`;

      expect(query.getValues({})).toEqual([
         "John1",
         "Doe1",
         "john1.doe1@example.com",
         "John2",
         "Doe2",
         "john2.doe2@example.com",
      ]);
      expect(query.getSql({})).toEqualQuery(
         `insert into "valnor_test"."account"
             ("first_name", "last_name", "email")
          values (?, ?, ?), (?, ?, ?)
          returning "account"."account_id" as "accountId", "account"."status", "account"."email", "account"."first_name" as "firstName", "account"."last_name" as "lastName", "account"."notes", "account"."created_at" as "createdAt", "account"."modified_at" as "modifiedAt", "account"."parent_id" as "parentId"`,
      );
   });
});
