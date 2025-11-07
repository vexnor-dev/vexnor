import { describe, expect, test } from "vitest";
import { sql } from "../../sql.js";
import { info } from "../../charms/index.js";
import { row } from "../sql-select-row.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { AccountStatusUdt } from "@test-models/valnor_test-enums.js";
import { SqlQueryContext } from "../sql-query-context.js";

describe("SqlQuery tests", () => {
   test("join sub-query with default queryName", () => {
      const subQuery = sql`
            select ${row(Account.$accountId, Account.$status, Account.$email)}
            from ${Account}
            where ${Account.$status} = ${AccountStatusUdt.CREATED}
         `;

      const rootQuery = sql`join ${subQuery}`;
      const context = new SqlQueryContext();
      rootQuery.build(context);
      expect(context.text).toEqualQuery(`
         join (select "a_1"."account_id"  as "accountId",
            "a_1"."status",
            "a_1"."email"
         from "valnor_test"."account" as "a_1"
         where "a_1"."status" = ?) as "query_1"
      `);
   });

   test("join sub-query with defined queryName", () => {
      const subQuery = sql`
         ${info({ label: "AccountsCreated" })}
            select ${row(Account.$accountId, Account.$status, Account.$email)}
            from ${Account}
            where ${Account.$status} = ${AccountStatusUdt.CREATED}
         `;
      const rootQuery = sql`join ${subQuery}`;

      const context = new SqlQueryContext();
      rootQuery.build(context);
      expect(context.text).toEqualQuery(`
         join (/* --label: AccountsCreated */
         select "a_1"."account_id"  as "accountId",
            "a_1"."status",
            "a_1"."email"
         from "valnor_test"."account" as "a_1"
         where "a_1"."status" = ?) as "AccountsCreated"
      `);
   });
});
