import { describe, expect, test } from "vitest";
import { Account } from "@test-models/valnor_test.schema.js";
import { sql } from "#/core/sql.js";
import { param } from "#/core/query/sql-param.js";
import { row } from "#/core/query/sql-select-row.js";
import { val } from "#/core/query/sql-select-value.js";
import { info } from "#/core/charms/sql-query-info.js";

describe("sql CTE (with clause) tests", () => {
   test("simple CTE with label naming", () => {
      const ActiveAccounts = sql`
         ${info({ label: "ActiveAccounts" })}
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$status} = 'active'
      `;

      const query = sql`
         with ${ActiveAccounts}
         select ${row(ActiveAccounts.$$)}
         from ${ActiveAccounts}
         where ${ActiveAccounts.$firstName} = ${param<{ firstName: string }>("firstName")}
      `;

      const { text, values } = query.getSql({ params: { firstName: "John" } });
      expect(values).toEqual(["John"]);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        WITH
          "ActiveAccounts" AS (
            /* <ActiveAccounts> */
            /* label: ActiveAccounts */
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
              "a_1"."status" = 'active'
              /* </ActiveAccounts> */
          )
        SELECT
          "ActiveAccounts".*
        FROM
          "ActiveAccounts"
        WHERE
          "ActiveAccounts"."firstName" = ?
          /* </query_0> */"
      `);
   });

   test("simple CTE with indexed naming", () => {
      const ActiveAccounts = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$status} = 'active'
      `;

      const query = sql`
         with ${ActiveAccounts}
                 select ${row(ActiveAccounts.$$)}
                 from ${ActiveAccounts}
                 where ${ActiveAccounts.$firstName} = ${param<{ firstName: string }>("firstName")}
      `;

      const { text, values } = query.getSql({ params: { firstName: "John" } });
      expect(values).toMatchInlineSnapshot(`
        [
          "John",
        ]
      `);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        WITH
          "query_1" AS (
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
              "a_1"."status" = 'active'
              /* </query_1> */
          )
        SELECT
          "query_1".*
        FROM
          "query_1"
        WHERE
          "query_1"."firstName" = ?
          /* </query_0> */"
      `);
   });

   test("multiple CTEs with label naming", () => {
      const ActiveAccounts = sql`
         ${info({ label: "ActiveAccounts" })}
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$status} = 'active'
      `;

      const RecentAccounts = sql`
         ${info({ label: "RecentAccounts" })}
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$createdAt} > ${param<{ since: Date }>("since")}
      `;

      const query = sql`
         with ${ActiveAccounts},
              ${RecentAccounts}
         select ${row(ActiveAccounts.$accountId, RecentAccounts.$email)}
         from ${ActiveAccounts}
         join ${RecentAccounts} on ${ActiveAccounts.$accountId} = ${RecentAccounts.$accountId}
      `;

      const since = new Date("2024-01-01");
      const { text, values } = query.getSql({ params: { since } });
      expect(values).toMatchInlineSnapshot(`
        [
          2024-01-01T00:00:00.000Z,
        ]
      `);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        WITH
          "ActiveAccounts" AS (
            /* <ActiveAccounts> */
            /* label: ActiveAccounts */
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
              "a_1"."status" = 'active'
              /* </ActiveAccounts> */
          ),
          "RecentAccounts" AS (
            /* <RecentAccounts> */
            /* label: RecentAccounts */
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
              "main"."account" AS "a_2"
            WHERE
              "a_2"."created_at" > ?
              /* </RecentAccounts> */
          )
        SELECT
          "ActiveAccounts"."accountId",
          "RecentAccounts"."email"
        FROM
          "ActiveAccounts"
          JOIN "RecentAccounts" ON "ActiveAccounts"."accountId" = "RecentAccounts"."accountId"
          /* </query_0> */"
      `);
   });

   test("multiple CTEs with indexed naming", () => {
      const ActiveAccounts = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$status} = 'active'
      `;

      const RecentAccounts = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$createdAt} > ${param<{ since: Date }>("since")}
      `;

      const query = sql`
         with ${ActiveAccounts},
              ${RecentAccounts}
         select ${row(ActiveAccounts.$accountId, RecentAccounts.$email)}
         from ${ActiveAccounts}
         join ${RecentAccounts} on ${ActiveAccounts.$accountId} = ${RecentAccounts.$accountId}
      `;

      const since = new Date("2024-01-01");
      const { text, values } = query.getSql({ params: { since } });
      expect(values).toMatchInlineSnapshot(`
        [
          2024-01-01T00:00:00.000Z,
        ]
      `);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        WITH
          "query_1" AS (
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
              "a_1"."status" = 'active'
              /* </query_1> */
          ),
          "query_2" AS (
            /* <query_2> */
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
              "main"."account" AS "a_2"
            WHERE
              "a_2"."created_at" > ?
              /* </query_2> */
          )
        SELECT
          "query_1"."accountId",
          "query_2"."email"
        FROM
          "query_1"
          JOIN "query_2" ON "query_1"."accountId" = "query_2"."accountId"
          /* </query_0> */"
      `);
   });

   test("CTE with aggregation and column reference", () => {
      const AccountCounts = sql`
         ${info({ label: "AccountCounts" })}
         select ${row(Account.$status)},
                ${val`count(*)`.as<{ total: number }>("total")}
         from ${Account}
         group by ${Account.$status}
      `;

      const query = sql`
         with ${AccountCounts}
         select ${row(AccountCounts.$status, AccountCounts.$total)}
         from ${AccountCounts}
         where ${AccountCounts.$total} > 10
      `;

      const { text } = query.getSql({});
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        WITH
          "AccountCounts" AS (
            /* <AccountCounts> */
            /* label: AccountCounts */
            SELECT
              "a_1"."status",
              /* <query_2> */
              count(*) /* </query_2> */ AS "total"
            FROM
              "main"."account" AS "a_1"
            GROUP BY
              "a_1"."status"
              /* </AccountCounts> */
          )
        SELECT
          "AccountCounts"."status",
          "AccountCounts"."total"
        FROM
          "AccountCounts"
        WHERE
          "AccountCounts"."total" > 10
          /* </query_0> */"
      `);
   });

   test("CTE column reference in val template", () => {
      const Children = sql`
         ${info({ label: "MaxCreatedAt" })}
         select ${row(Account.$parentId)}, ${val`max(${Account.$createdAt})`.as<{ lastCreatedAt: Date }>("lastCreatedAt")}
         from ${Account}
         group by ${Account.$parentId}
      `;

      const query = sql`
         with ${Children}
                 select ${row(Account.$$, Children.$lastCreatedAt)}
                 from ${Account}
                         left join ${Children} on ${Account.$accountId} = ${Children.$parentId}
      `;

      const { text } = query.getSql({});
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        WITH
          "MaxCreatedAt" AS (
            /* <MaxCreatedAt> */
            /* label: MaxCreatedAt */
            SELECT
              "a_1"."parent_id" AS "parentId",
              /* <query_2> */ max("a_1"."created_at") /* </query_2> */ AS "lastCreatedAt"
            FROM
              "main"."account" AS "a_1"
            GROUP BY
              "a_1"."parent_id"
              /* </MaxCreatedAt> */
          )
        SELECT
          "a_2"."account_id" AS "accountId",
          "a_2"."status",
          "a_2"."email",
          "a_2"."first_name" AS "firstName",
          "a_2"."last_name" AS "lastName",
          "a_2"."notes",
          "a_2"."created_at" AS "createdAt",
          "a_2"."modified_at" AS "modifiedAt",
          "a_2"."parent_id" AS "parentId",
          "MaxCreatedAt"."lastCreatedAt"
        FROM
          "main"."account" AS "a_2"
          LEFT JOIN "MaxCreatedAt" ON "a_2"."account_id" = "MaxCreatedAt"."parentId"
          /* </query_0> */"
      `);
   });
});
