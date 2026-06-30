import { describe, expect, test } from "vitest";
import { Account } from "@vexnor/core/testing";
import { sql, row } from "@vexnor/core";
import { postgresInsertRows } from "#src/crud/postgres-insert-rows.js";
import { defaultQueryOptions } from "#src/default-query-options.js";
import { postgresInsertFrom } from "#src/crud/postgres-insert-from.js";

describe("postgresInsertRows()", () => {
   test("basic insert", () => {
      const insertRows = postgresInsertRows(Account);
      const { text, values } = insertRows.source.getSql({
         params: { rows: [{ email: "a@b.com", firstName: "John", lastName: "Doe" }] },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        INSERT INTO
          "main"."account" ("email", "first_name", "last_name")
        VALUES
          ($1, $2, $3)
        RETURNING
          "account"."account_id" AS "accountId",
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
      expect(values).toMatchObject(["a@b.com", "John", "Doe"]);
   });

   test("batch insert", () => {
      const insertRows = postgresInsertRows(Account);
      const { text, values } = insertRows.source.getSql({
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
        /* driver: postgres */
        INSERT INTO
          "main"."account" ("email", "first_name", "last_name")
        VALUES
          ($1, $2, $3),
          ($4, $5, $6)
        RETURNING
          "account"."account_id" AS "accountId",
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
      expect(values).toMatchObject(["a@b.com", "John", "Doe", "b@b.com", "Jane", "Smith"]);
   });

   test("insert from subquery", () => {
      const insertFrom = postgresInsertFrom(Account, {
         FROM: sql`select ${row(Account.$$)} from ${Account} where ${Account.$status} = 'active'`,
      });

      const { text } = insertFrom.source.getSql({ options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
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
          "a_1"."status" = 'active' /* </query_1> */
        RETURNING
          "account"."account_id" AS "accountId",
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

   test("has $$ and row", () => {
      const insert = postgresInsertRows(Account);
      expect(insert.source.$$).toBeDefined();
      expect(insert.source.row).toBeDefined();
      expect(insert.source.row.$accountId).toBeDefined();
   });
});
