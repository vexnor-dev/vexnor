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

      const { values, text } = query.getSql({});
      expect(values).toEqual(["john1.doe1@example.com", "John1", "Doe1", "john2.doe2@example.com", "John2", "Doe2"]);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "main"."account" ("email", "first_name", "last_name") output "inserted"."account_id" AS "accountId",
          "inserted"."status",
          "inserted"."email",
          "inserted"."first_name" AS "firstName",
          "inserted"."last_name" AS "lastName",
          "inserted"."notes",
          "inserted"."created_at" AS "createdAt",
          "inserted"."modified_at" AS "modifiedAt",
          "inserted"."parent_id" AS "parentId"
        VALUES
          (?, ?, ?),
          (?, ?, ?)
          /* </query_0> */"
      `);
   });
});
