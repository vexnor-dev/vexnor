import { describe, expect, test } from "vitest";
import { Account, IAccountInsert } from "@test-models/valnor_test.account-table.js";
import { sql } from "../../sql.js";
import { row } from "../../query/index.js";

describe("SqlTable.insertColsVals() tests", () => {
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
            ${Account.insertColsVals(...rows)}
            returning ${row(Account.$$)}`;

      const { values, text } = query.getSql({});
      expect(values).toEqual(["john1.doe1@example.com", "John1", "Doe1", "john2.doe2@example.com", "John2", "Doe2"]);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "main"."account" ("email", "first_name", "last_name")
        VALUES
          (?, ?, ?),
          (?, ?, ?) returning "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */"
      `);
   });

   test("sql() insert with different key orders produces canonical order", () => {
      const rows: IAccountInsert[] = [
         {
            firstName: "John1",
            lastName: "Doe1",
            email: "john1.doe1@example.com",
         },
         {
            email: "john2.doe2@example.com",
            firstName: "John2",
            lastName: "Doe2",
         },
         {
            lastName: "Doe3",
            email: "john3.doe3@example.com",
            firstName: "John3",
         },
      ];
      const query = sql`
         insert into ${Account}
            ${Account.insertColsVals(...rows)}
            returning ${row(Account.$$)}`;

      const { values, text } = query.getSql({});
      expect(values).toEqual([
         "john1.doe1@example.com",
         "John1",
         "Doe1",
         "john2.doe2@example.com",
         "John2",
         "Doe2",
         "john3.doe3@example.com",
         "John3",
         "Doe3",
      ]);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "main"."account" ("email", "first_name", "last_name")
        VALUES
          (?, ?, ?),
          (?, ?, ?),
          (?, ?, ?) returning "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */"
      `);
   });

   test("throws error when inserts have different columns", () => {
      const rows: IAccountInsert[] = [
         {
            firstName: "John1",
            lastName: "Doe1",
            email: "john1.doe1@example.com",
         },
         {
            firstName: "John2",
            email: "john2.doe2@example.com",
         } as IAccountInsert,
      ];

      expect(() => Account.insertColsVals(...rows)).toThrow("Row 1 has different columns than row 0");
   });
});
