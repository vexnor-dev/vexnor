import { describe, expect, test } from "vitest";
import { Account, IAccountInsert } from "@test-models/valnor_test.account-table.js";
import { sql } from "../../sql.js";
import { row } from "../../query/index.js";

describe("SqlTable.$$cols() and $$rows() tests", () => {
   test("sql() insert with $$cols() and $$rows()", () => {
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
            ${Account.$cols(...rows)}
            output ${row(Account`inserted`.$all)}
            ${Account.$rows(...rows)}`;

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
             output "inserted"."account_id" as "accountId",
             "inserted"."status",
             "inserted"."email",
             "inserted"."first_name" as "firstName",
             "inserted"."last_name" as "lastName",
             "inserted"."notes",
             "inserted"."created_at" as "createdAt",
             "inserted"."modified_at" as "modifiedAt",
             "inserted"."parent_id" as "parentId"
         values (?, ?, ?),
                (?, ?, ?)
         `,
      );
   });
});
