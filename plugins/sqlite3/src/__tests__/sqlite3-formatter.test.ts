// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test } from "vitest";
import { Account } from "@vexnor/core/testing";
import { sql, row } from "@vexnor/core";
import "#/sqlite3-augment.js";
import "@vexnor/sqlite3";

describe("Sqlite3Formatter", () => {
   test("INSERT INTO - column uses columnName format (no alias)", () => {
      const q = sql`INSERT INTO ${Account} (${Account.$firstName}, ${Account.$email}) VALUES ('A', 'a@b.com')`;
      const { text } = q.getSql({ options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "main"."account" ("first_name", "email")
        VALUES
          ('A', 'a@b.com') /* </query_0> */"
      `);
   });

   test("UPDATE — table uses schema.tableName format", () => {
      const q = sql`UPDATE ${Account} SET ${Account.$firstName} = 'B' WHERE ${Account.$accountId} = 1`;
      const { text } = q.getSql({ options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "main"."account"
        SET
          "first_name" = 'B'
        WHERE
          "account"."account_id" = 1 /* </query_0> */"
      `);
   });

   test("SELECT — uses default table and column format", () => {
      const q = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      const { text } = q.getSql({ options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."email"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("DELETE — uses default format", () => {
      const q = sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = 1`;
      const { text } = q.getSql({ options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        DELETE FROM "main"."account"
        WHERE
          "account"."account_id" = 1 /* </query_0> */"
      `);
   });

   test("RETURNING — column uses tableName.columnName AS columnAlias format", () => {
      const q = sql`INSERT INTO ${Account} (${Account.$firstName}, ${Account.$email}) VALUES ('X', 'x@y.com') RETURNING ${Account.$accountId}`;
      const { text } = q.getSql({ options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "main"."account" ("first_name", "email")
        VALUES
          ('X', 'x@y.com')
        RETURNING
          "account"."account_id" AS "accountId" /* </query_0> */"
      `);
   });
});
