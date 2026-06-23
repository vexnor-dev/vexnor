import { describe, expect, test } from "vitest";
import { Account } from "@vexnor/core/testing";
import { sql, row } from "@vexnor/core";
import { mssqlInsertRows } from "#/crud/mssql-insert-rows.js";
import { defaultQueryOptions } from "#/default-query-options.js";
import { mssqlInsertFrom } from "#/crud/mssql-insert-from.js";

describe("mssqlTableCreate()", () => {
   test("basic insert", () => {
      const query = mssqlInsertRows(Account);
      const { text, values } = query.source.getSql({
         params: { rows: [{ email: "a@b.com", firstName: "John", lastName: "Doe" }] },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
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
          (@param_0, @param_1, @param_2)
          /* </query_0> */"
      `);
      expect(values).toMatchObject(["a@b.com", "John", "Doe"]);
   });

   test("batch insert", () => {
      const query = mssqlInsertRows(Account);
      const { text, values } = query.source.getSql({
         params: {
            rows: [
               { email: "a@b.com", firstName: "John", lastName: "Doe" },
               { email: "b@b.com", firstName: "Jane", lastName: "Smith" },
            ],
         },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
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
          (@param_0, @param_1, @param_2),
          (@param_3, @param_4, @param_5)
          /* </query_0> */"
      `);
      expect(values).toMatchObject(["a@b.com", "John", "Doe", "b@b.com", "Jane", "Smith"]);
   });

   test("insert from subquery", () => {
      const query = mssqlInsertFrom(Account, {
         FROM: sql`select ${row(Account.$$)} from ${Account} where ${Account.$status} = 'active'`,
      });

      const { text } = query.source.getSql({ options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        INSERT INTO
          "main"."account"
          /* <query_1> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1"
        WHERE
          "a_1"."status" = 'active' /* </query_1> */ output "inserted"."account_id" AS "accountId",
          "inserted"."status",
          "inserted"."email",
          "inserted"."first_name" AS "firstName",
          "inserted"."last_name" AS "lastName",
          "inserted"."notes",
          "inserted"."created_at" AS "createdAt",
          "inserted"."modified_at" AS "modifiedAt",
          "inserted"."parent_id" AS "parentId"
          /* </query_0> */"
      `);
   });

   test("has $$ and row", () => {
      const query = mssqlInsertRows(Account);
      expect(query.source.$$).toBeDefined();
      expect(query.source.row).toBeDefined();
      expect(query.source.row.$accountId).toBeDefined();
   });
});
