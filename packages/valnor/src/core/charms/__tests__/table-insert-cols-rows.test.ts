import { describe, expect, test } from "vitest";
import { Account, IAccountInsert } from "@test-models/valnor_test.account-table.js";
import { sql } from "../../sql.js";
import { row } from "../../query/index.js";

describe("SqlTable.insertCols() and insertCols() tests", () => {
   test("sql() insert with $$cols() and $$rows()", () => {
      const rows: IAccountInsert[] = [
         {
            firstName: "John1",
            email: "john1.doe1@example.com",
            lastName: "Doe1",
         },
         {
            lastName: "Doe2",
            firstName: "John2",
            email: "john2.doe2@example.com",
         },
      ];
      const query = sql`
         insert into ${Account}
            ${Account.insertCols(...rows)}
            output ${row(Account.as`inserted`.$$)}
            ${Account.insertVals(...rows)}`;

      expect(query.getValues({})).toEqual([
         "john1.doe1@example.com",
         "John1",
         "Doe1",
         "john2.doe2@example.com",
         "John2",
         "Doe2",
      ]);
      expect(query.getSql({})).toEqualQuery(
         `insert into "valnor_test"."account"
             ("email", "first_name", "last_name")
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
