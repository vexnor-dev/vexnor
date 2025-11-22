import { describe, expect, test } from "vitest";
import { Account } from "./models/valnor_test.schema.js";
import { sql } from "../sql.js";
import { param, row, val } from "../query/index.js";
import { info } from "../charms/index.js";

describe("sql CTE (with clause) tests", () => {
   test("simple CTE with automatic naming", () => {
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

      expect(query.getSql({ params: { firstName: "John" } })).toEqualQuery(`
         with "ActiveAccounts" as (
            /* --label: ActiveAccounts */
            select "a_1"."account_id" as "accountId",
                   "a_1"."status",
                   "a_1"."email",
                   "a_1"."first_name" as "firstName",
                   "a_1"."last_name" as "lastName",
                   "a_1"."notes",
                   "a_1"."created_at" as "createdAt",
                   "a_1"."modified_at" as "modifiedAt",
                   "a_1"."parent_id" as "parentId"
            from "valnor_test"."account" as "a_1"
            where "a_1"."status" = 'active'
         )
         select "ActiveAccounts".*
         from "ActiveAccounts"
         where "ActiveAccounts"."firstName" = ?
      `);
   });

   test("multiple CTEs with automatic naming", () => {
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
      expect(query.getSql({ params: { since } })).toEqualQuery(`
         with "ActiveAccounts" as (
            /* --label: ActiveAccounts */
            select "a_1"."account_id" as "accountId",
                   "a_1"."status",
                   "a_1"."email",
                   "a_1"."first_name" as "firstName",
                   "a_1"."last_name" as "lastName",
                   "a_1"."notes",
                   "a_1"."created_at" as "createdAt",
                   "a_1"."modified_at" as "modifiedAt",
                   "a_1"."parent_id" as "parentId"
            from "valnor_test"."account" as "a_1"
            where "a_1"."status" = 'active'
         ),
         "RecentAccounts" as (
            /* --label: RecentAccounts */
            select "a_2"."account_id" as "accountId",
                   "a_2"."status",
                   "a_2"."email",
                   "a_2"."first_name" as "firstName",
                   "a_2"."last_name" as "lastName",
                   "a_2"."notes",
                   "a_2"."created_at" as "createdAt",
                   "a_2"."modified_at" as "modifiedAt",
                   "a_2"."parent_id" as "parentId"
            from "valnor_test"."account" as "a_2"
            where "a_2"."created_at" > ?
         )
         select "ActiveAccounts"."accountId", "ActiveAccounts"."email"
         from "ActiveAccounts"
         join "RecentAccounts" on "ActiveAccounts"."accountId" = "RecentAccounts"."accountId"
      `);
   });

   test("CTE with aggregation and column reference", () => {
      const AccountCounts = sql`
         ${info({ label: "AccountCounts" })}
         select ${row(Account.$status)},
                ${val<number>`count(*)`.as("total")}
         from ${Account}
         group by ${Account.$status}
      `;

      const query = sql`
         with ${AccountCounts}
         select ${row(AccountCounts.$status, AccountCounts.$total)}
         from ${AccountCounts}
         where ${AccountCounts.$total} > 10
      `;

      expect(query.getSql({})).toEqualQuery(`
         with "AccountCounts" as (
            /* --label: AccountCounts */
            select "a_1"."status",
                   count(*) as "total"
            from "valnor_test"."account" as "a_1"
            group by "a_1"."status"
         )
         select "AccountCounts"."status", "AccountCounts"."total"
         from "AccountCounts"
         where "AccountCounts"."total" > 10
      `);
   });

   test("CTE column reference in val template", () => {
      const MaxCreatedAt = sql`
         ${info({ label: "MaxCreatedAt" })}
         select ${val<Date>`max(${Account.$createdAt})`.as("maxDate")}
         from ${Account}
      `;

      const query = sql`
         with ${MaxCreatedAt}
         select ${row(Account.$$)}
         from ${Account}, ${MaxCreatedAt}
         where ${Account.$createdAt} = ${MaxCreatedAt.$maxDate}
      `;

      expect(query.getSql({})).toEqualQuery(`
         with "MaxCreatedAt" as (
            /* --label: MaxCreatedAt */
            select max("a_1"."created_at") as "maxDate"
            from "valnor_test"."account" as "a_1"
         )
         select "a_2"."account_id" as "accountId",
                "a_2"."status",
                "a_2"."email",
                "a_2"."first_name" as "firstName",
                "a_2"."last_name" as "lastName",
                "a_2"."notes",
                "a_2"."created_at" as "createdAt",
                "a_2"."modified_at" as "modifiedAt",
                "a_2"."parent_id" as "parentId"
         from "valnor_test"."account" as "a_2", "MaxCreatedAt"
         where "a_2"."created_at" = "MaxCreatedAt"."maxDate"
      `);
   });
});
