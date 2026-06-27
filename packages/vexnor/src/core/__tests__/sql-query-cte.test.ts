import { describe, expect, test } from "vitest";
import { Account } from "@test-models/vexnor_dev.schema.js";
import { sql } from "#src/core/sql.js";
import { param } from "#src/core/query/sql-param.js";
import { row } from "#src/core/query/sql-select-row.js";
import { val } from "#src/core/query/sql-select-value.js";
import { info } from "#src/core/charms/sql-query-info.js";
import { col } from "#src/core/query/sql-select-column.js";

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

   test("recursive CTE: self-reference renders as CTE name", () => {
      const anchor = sql`
         select ${row(Account.$$)}, ${val`0`.as<{ depth: number }>("depth")}
         from ${Account}
         where ${Account.$parentId} is null
      `;

      const hierarchy = sql`
         ${anchor} union all
         select ${row(Account.as("b").$$)}, ${val`${anchor.$depth} + 1`.as<{ depth: number }>("depth")}
         from ${Account.as("b")}
         join ${anchor.out} on ${anchor.out.$accountId} = ${Account.as("b").$parentId}
      `;

      const query = sql`
         with recursive ${hierarchy}
         select ${row(hierarchy.$$)}
         from ${hierarchy}
         order by ${hierarchy.$depth}, ${hierarchy.$email}
      `;

      const { text } = query.getSql({});
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        WITH RECURSIVE
          "query_1" AS (
            /* <query_1> */
            /* <query_2> */
            SELECT
              "a_1"."account_id" AS "accountId",
              "a_1"."status",
              "a_1"."email",
              "a_1"."first_name" AS "firstName",
              "a_1"."last_name" AS "lastName",
              "a_1"."notes",
              "a_1"."created_at" AS "createdAt",
              "a_1"."modified_at" AS "modifiedAt",
              "a_1"."parent_id" AS "parentId",
              /* <query_3> */ 0 /* </query_3> */ AS "depth"
            FROM
              "main"."account" AS "a_1"
            WHERE
              "a_1"."parent_id" IS NULL
              /* </query_2> */
            UNION ALL
            SELECT
              "b"."account_id" AS "accountId",
              "b"."status",
              "b"."email",
              "b"."first_name" AS "firstName",
              "b"."last_name" AS "lastName",
              "b"."notes",
              "b"."created_at" AS "createdAt",
              "b"."modified_at" AS "modifiedAt",
              "b"."parent_id" AS "parentId",
              /* <query_4> */ "query_2"."depth" + 1 /* </query_4> */ AS "depth"
            FROM
              "main"."account" AS "b"
              JOIN "query_1" ON "query_1"."accountId" = "b"."parent_id"
              /* </query_1> */
          )
        SELECT
          "query_1".*
        FROM
          "query_1"
        ORDER BY
          "query_1"."depth",
          "query_1"."email"
          /* </query_0> */"
      `);
   });

   test("recursive CTE: mixed with non-recursive CTE", () => {
      const anchor = sql`
         select ${row(Account.$accountId, Account.$parentId, Account.$email)},
                ${val`0`.as<{ depth: number }>("depth")}
         from ${Account}
         where ${Account.$parentId} is null
      `;

      const hierarchy = sql`
         ${anchor} union all
         select ${row(Account.as("b").$accountId, Account.as("b").$parentId, Account.as("b").$email)},
                ${anchor.out.$depth} + 1 as ${col<{ depth: number }>("depth")}
         from ${Account.as("b")}
         join ${anchor.out} on ${anchor.out.$accountId} = ${Account.as("b").$parentId}
      `;

      const ActiveAccounts = sql`
         ${info({ label: "ActiveAccounts" })}
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$status} = 'active'
      `;

      const query = sql`
         with recursive ${hierarchy}, ${ActiveAccounts}
         select ${row(hierarchy.$accountId, hierarchy.$depth, ActiveAccounts.$email)}
         from ${hierarchy}
         join ${ActiveAccounts} on ${ActiveAccounts.$accountId} = ${hierarchy.$accountId}
         order by ${hierarchy.$depth}
      `;

      const { text } = query.getSql({});
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        WITH RECURSIVE
          "query_1" AS (
            /* <query_1> */
            /* <query_2> */
            SELECT
              "a_1"."account_id" AS "accountId",
              "a_1"."parent_id" AS "parentId",
              "a_1"."email",
              /* <query_3> */
              0 /* </query_3> */ AS "depth"
            FROM
              "main"."account" AS "a_1"
            WHERE
              "a_1"."parent_id" IS NULL
              /* </query_2> */
            UNION ALL
            SELECT
              "b"."account_id" AS "accountId",
              "b"."parent_id" AS "parentId",
              "b"."email",
              "query_1"."depth" + 1 AS "depth"
            FROM
              "main"."account" AS "b"
              JOIN "query_1" ON "query_1"."accountId" = "b"."parent_id"
              /* </query_1> */
          ),
          "ActiveAccounts" AS (
            /* <ActiveAccounts> */
            /* label: ActiveAccounts */
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
              "a_2"."status" = 'active'
              /* </ActiveAccounts> */
          )
        SELECT
          "query_1"."accountId",
          "query_1"."depth",
          "ActiveAccounts"."email"
        FROM
          "query_1"
          JOIN "ActiveAccounts" ON "ActiveAccounts"."accountId" = "query_1"."accountId"
        ORDER BY
          "query_1"."depth"
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
