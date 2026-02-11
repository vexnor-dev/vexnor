import { describe, expect, test } from "vitest";
import { Account } from "./models/valnor_test.schema.js";
import { sql } from "../sql.js";
import { param, row, type, TYPES, val } from "../query/index.js";
import { info } from "../charms/index.js";

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
         where ${ActiveAccounts.$firstName} = ${param("firstName").is<string>()}
      `;

      const { text, values } = query.getSql({ params: { firstName: "John" } });
      expect(values).toMatchInlineSnapshot(`
        [
          "John",
        ]
      `);
      expect(text).toMatchInlineSnapshot(`
        "WITH
          "ActiveAccounts" AS (
            /* --label: ActiveAccounts */
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
              "a_1"."status" = 'active'
          )
        SELECT
          "ActiveAccounts".*
        FROM
          "ActiveAccounts"
        WHERE
          "ActiveAccounts"."firstName" = ?"
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
                 where ${ActiveAccounts.$firstName} = ${param("firstName").is<string>()}
      `;

      const { text, values } = query.getSql({ params: { firstName: "John" } });
      expect(values).toMatchInlineSnapshot(`
        [
          "John",
        ]
      `);
      expect(text).toMatchInlineSnapshot(`
        "WITH
          "query_1" AS (
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
              "a_1"."status" = 'active'
          )
        SELECT
          "query_1".*
        FROM
          "query_1"
        WHERE
          "query_1"."firstName" = ?"
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
         where ${Account.$createdAt} > ${param("since").is<Date>()}
      `;

      const query = sql`
         with ${ActiveAccounts},
              ${RecentAccounts}
         select ${row(ActiveAccounts.$accountId, ActiveAccounts.$email)}
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
        "WITH
          "ActiveAccounts" AS (
            /* --label: ActiveAccounts */
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
              "a_1"."status" = 'active'
          ),
          "RecentAccounts" AS (
            /* --label: RecentAccounts */
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
              "a_2"."created_at" > ?
          )
        SELECT
          "ActiveAccounts"."accountId",
          "ActiveAccounts"."email"
        FROM
          "ActiveAccounts"
          JOIN "RecentAccounts" ON "ActiveAccounts"."accountId" = "RecentAccounts"."accountId""
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
         where ${Account.$createdAt} > ${param("since").is<Date>()}
      `;

      const r = row(ActiveAccounts.$accountId, RecentAccounts.$email);

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
        "WITH
          "query_1" AS (
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
              "a_1"."status" = 'active'
          ),
          "query_2" AS (
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
              "a_2"."created_at" > ?
          )
        SELECT
          "query_1"."accountId",
          "query_2"."email"
        FROM
          "query_1"
          JOIN "query_2" ON "query_1"."accountId" = "query_2"."accountId""
      `);
   });

   test("CTE with aggregation and column reference", () => {
      const AccountCounts = sql`
         ${info({ label: "AccountCounts" })}
         select ${row(Account.$status)},
                ${val`count(*)`.as({ total: type<number>() })}
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
        "WITH
          "AccountCounts" AS (
            /* --label: AccountCounts */
            SELECT
              "a_1"."status",
              count(*) AS "total"
            FROM
              "valnor_test"."account" AS "a_1"
            GROUP BY
              "a_1"."status"
          )
        SELECT
          "AccountCounts"."status",
          "AccountCounts"."total"
        FROM
          "AccountCounts"
        WHERE
          "AccountCounts"."total" > 10"
      `);
   });

   test("CTE column reference in val template", () => {
      const MaxCreatedAt = sql`
         ${info({ label: "MaxCreatedAt" })}
         select ${val`max(${Account.$createdAt})`.as({ maxDate: TYPES.Date })}
         from ${Account}
      `;

      const query = sql`
         with ${MaxCreatedAt}
         select ${row(Account.$$)}
         from ${Account}, ${MaxCreatedAt}
         where ${Account.$createdAt} = ${MaxCreatedAt.$maxDate}
      `;

      const { text } = query.getSql({});
      expect(text).toMatchInlineSnapshot(`
        "WITH
          "MaxCreatedAt" AS (
            /* --label: MaxCreatedAt */
            SELECT
              max("a_1"."created_at") AS "maxDate"
            FROM
              "valnor_test"."account" AS "a_1"
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
          "a_2"."parent_id" AS "parentId"
        FROM
          "valnor_test"."account" AS "a_2",
          "MaxCreatedAt"
        WHERE
          "a_2"."created_at" = "MaxCreatedAt"."maxDate""
      `);
   });
});
