import { describe, expect, test } from "vitest";
import { sql } from "../../sql.js";
import { info } from "../../charms/index.js";
import { row } from "../sql-select-row.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { AccountStatusUdt } from "@test-models/valnor_test-enums.js";
import { SqlBuildContext } from "../sql-build-context.js";

describe("SqlQuery tests", () => {
   test("SqlQuery row type inference", () => {
      const query = sql`select ${row(Account.$accountId, Account.$status, Account.$email)} from ${Account}`;
      expect(query.row).toBeDefined();
      expect(query.row).toMatchObject({
         $accountId: {
            columnName: "accountId",
            key: "accountId",
            tableInfo: null,
         },
         $status: { columnName: "status", key: "status", tableInfo: null },
         $email: { columnName: "email", key: "email", tableInfo: null },
      });
      expect(Object.keys(query.row)).toMatchObject(["$accountId", "$status", "$email"]);
      expect(query.$accountId).toBeDefined();
      expect(query.$status).toBeDefined();
      expect(query.$email).toBeDefined();
      expect(Reflect.ownKeys(query)).toMatchObject([
         "wrap",
         "ID",
         "rawStrings",
         "rawValues",
         "info",
         "isFragment",
         "row",
         "$$",
         "params",
         "$accountId",
         "$status",
         "$email",
      ]);
      expect(query.$$).toBeDefined();
   });

   test("join sub-query with default queryName", () => {
      const subQuery = sql`
            select ${row(Account.$accountId, Account.$status, Account.$email)}
            from ${Account}
            where ${Account.$status} = ${AccountStatusUdt.CREATED}
         `;

      const query = sql`join ${subQuery}`;
      const context = new SqlBuildContext({ query });
      query.build(context);
      expect(context.text).toMatchInlineSnapshot(`
        "JOIN (
          SELECT
            "a_1"."account_id" AS "accountId",
            "a_1"."status",
            "a_1"."email"
          FROM
            "valnor_test"."account" AS "a_1"
          WHERE
            "a_1"."status" = ?
        ) AS "query_1""
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

      const context = new SqlBuildContext();
      rootQuery.build(context);
      expect(context.text).toMatchInlineSnapshot(`
        "JOIN (
          /* --label: AccountsCreated */
          SELECT
            "a_1"."account_id" AS "accountId",
            "a_1"."status",
            "a_1"."email"
          FROM
            "valnor_test"."account" AS "a_1"
          WHERE
            "a_1"."status" = ?
        ) AS "AccountsCreated""
      `);
   });

   test("sql query formatting", () => {
      const query = sql`
            select ${row(Account.$accountId, Account.$status, Account.$email)}
            from ${Account}
         `;
      expect(query.getSql({}).text).toMatchInlineSnapshot(`
        "SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email"
        FROM
          "valnor_test"."account" AS "a_1""
      `);
   });
});
