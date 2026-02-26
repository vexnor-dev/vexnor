import { describe, expect, test } from "vitest";
import { Account } from "valnor/testing";
import { sql } from "valnor";

describe("sqlite3 formatting", () => {
   test("should format table insert without alias", () => {
      const query = sql`INSERT INTO ${Account} (${Account.$firstName}, ${Account.$email}) VALUES ('John', 'john@example.com')`;
      const { text } = query.getSql({ options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "main"."account" ("first_name", "email")
        VALUES
          ('John', 'john@example.com')
          /* </query_0> */"
      `);
   });

   test("should format table insert with alias", () => {
      const query = sql`INSERT INTO ${Account.as("a")} (${Account.as("a").$firstName}, ${Account.as("a").$email}) VALUES ('John', 'john@example.com')`;
      const { text } = query.getSql({ options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "main"."account" ("first_name", "email")
        VALUES
          ('John', 'john@example.com')
          /* </query_0> */"
      `);
   });

   test("should format SELECT statements", () => {
      const query = sql`SELECT ${Account.$$} FROM ${Account} WHERE ${Account.$accountId} = 1`;
      const { text } = query.getSql({ options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
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
          "a_1"."account_id" = 1
          /* </query_0> */"
      `);
   });

   test("should format UPDATE statements", () => {
      const query = sql`UPDATE ${Account} SET ${Account.$firstName} = 'Jane' WHERE ${Account.$accountId} = 1`;
      const { text } = query.getSql({ options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "main"."account"
        SET
          "first_name" = 'Jane'
        WHERE
          "account"."account_id" = 1
          /* </query_0> */"
      `);
   });

   test("should format DELETE statements", () => {
      const query = sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = 1`;
      const { text } = query.getSql({ options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        DELETE FROM "main"."account"
        WHERE
          "account"."account_id" = 1
          /* </query_0> */"
      `);
   });
});
