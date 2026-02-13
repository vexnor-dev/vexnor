import { describe, expect, test } from "vitest";
import { Account, AccountStatusUdt } from "./models/valnor_test.schema.js";
import { ExtractParamsFromQuery, sql } from "../sql.js";
import { info } from "../charms/index.js";
import { param, row } from "../query/index.js";

describe("sql subqueries tests", () => {
   test("sub-query CTE/with", () => {
      const AccountsCreated = sql`
         ${info({ label: "AccountsCreated" })}
            select ${row(Account.$$)}
            from ${Account}
            where ${Account.$status} = ${AccountStatusUdt.CREATED}
         `;

      const AccountsOld = sql`
         ${info({ label: "AccountsOld" })}
         select ${row(Account.$$)}
         where ${Account.$createdAt} = ${Date.parse("2020-01-01")}
      `;

      const query = sql`
         with AccountsCreated as (${AccountsCreated}),
              AccountsOlds as
                    (${AccountsOld})
         select ${row(Account.$$)}
         from ${Account}
                 join ${AccountsCreated} on ${Account.$accountId} = ${AccountsCreated.$accountId}
            join ${AccountsOld} on ${Account.$accountId} = ${AccountsOld.$accountId}         
      `;

      type Params = ExtractParamsFromQuery<typeof query>;
      const params: Params = undefined;
      console.log(query.getSql({}));
      expect(params).toBeUndefined();
   });

   test("sub-query from", () => {
      const AccountsWithEmail = sql`
         ${info({ label: "AccountsWithEmail" })}
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$email} = ${param<{ email: string }>("email")}`;

      const query = sql`
         select ${row(AccountsWithEmail.$$)}
         from ${AccountsWithEmail}
         where ${AccountsWithEmail.$firstName} = ${param<{ firstName: string }>("firstName")}`;

      const { text, values } = query.getSql({ params: { firstName: "John", email: "test@example.com" } });
      expect(values).toEqual(["test@example.com", "John"]);
      expect(text).toMatchInlineSnapshot(`
        "SELECT
          "AccountsWithEmail".*
        FROM
          (
            /* --label: AccountsWithEmail */
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
              "valnor_test"."account" AS "a_1"
            WHERE
              "a_1"."email" = ?
          ) AS "AccountsWithEmail"
        WHERE
          "AccountsWithEmail"."firstName" = ?"
      `);
   });

   test("sub-query join", () => {
      const AccountsWithEmail = sql`
         ${info({ label: "AccountsWithEmail" })}
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$email} = ${param<{ email: string }>("email")}
      `;

      const query = sql`
         select ${row(Account.$accountId, Account.$status, Account.$email, Account.$firstName, Account.$lastName)}
         from ${Account}
                 join ${AccountsWithEmail} on ${Account.$accountId} = ${AccountsWithEmail.$accountId}
         where ${Account.$firstName} = ${param<{ firstName: string }>("firstName")}`;

      const { text, values } = query.getSql({ params: { firstName: "John", email: "test@example.com" } });
      expect(values).toEqual(["test@example.com", "John"]);
      expect(text).toMatchInlineSnapshot(`
        "SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName"
        FROM
          "valnor_test"."account" AS "a_1"
          JOIN (
            /* --label: AccountsWithEmail */
            SELECT
              "a_2"."account_id" AS "accountId",
              "a_2"."status",
              "a_2"."email",
              "a_2"."first_name" AS "firstName",
              "a_2"."last_name" AS "lastName",
              "a_2"."notes",
              "a_2"."created_at" AS "createdAt",
              "a_2"."modified_at" AS "modifiedAt",
              "a_2"."parent_id" AS "parentId"
            FROM
              "valnor_test"."account" AS "a_2"
            WHERE
              "a_2"."email" = ?
          ) AS "AccountsWithEmail" ON "a_1"."account_id" = "AccountsWithEmail"."accountId"
        WHERE
          "a_1"."first_name" = ?"
      `);
   });

   test("self join", () => {
      const query = sql`
         select ${row(Account.$$, Account.as`parent`.$firstName.as("parentFirstName"), Account.as`parent`.$lastName.as("parentLastName"))}
         from ${Account}
                 join ${Account.as`parent`} on ${Account.as`parent`.$accountId} = ${Account.$parentId}
         where ${Account.$firstName} = ${param<{ firstName: string }>("firstName")}`;

      const { text } = query.getSql({ params: { firstName: "John" } });
      expect(text).toMatchInlineSnapshot(`
        "SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId",
          "parent"."first_name" AS "parentFirstName",
          "parent"."last_name" AS "parentLastName"
        FROM
          "valnor_test"."account" AS "a_1"
          JOIN "valnor_test"."account" AS "parent" ON "parent"."account_id" = "a_1"."parent_id"
        WHERE
          "a_1"."first_name" = ?"
      `);
   });
});
