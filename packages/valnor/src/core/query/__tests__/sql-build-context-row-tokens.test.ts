import { describe, expect, test } from "vitest";
import { sql } from "../../sql.js";
import { row } from "../sql-select-row.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { classCounters } from "../../sql-base.js";
import { SqlBuildContext } from "../sql-build-context.js";
import { val } from "../sql-select-value.js";

describe("SqlBuildContextRowTokens", () => {
   test("should identify row token from 2-level query", () => {
      const query1 = sql`select ${row(Account.$accountId, Account.$status)} from ${Account}`;
      const query0 = sql`select ${row(query1.$accountId)} from ${query1}`;
      expect(classCounters).toMatchInlineSnapshot(`
        Map {
          "SqlSelectRow" => 2,
          "SqlQuery" => 2,
          "SqlSelectColumn" => 3,
          "SqlSelectAll" => 2,
        }
      `);

      expect(query1.$accountId).toMatchObject({
         type: "SqlSelectColumn",
         key: "accountId",
         id: "SqlSelectColumn#1(SqlQuery#1/SqlTableColumn#1(account.account_id as accountId))",
         query: {
            id: `SqlQuery#1`,
         },
         target: {
            key: "accountId",
            id: "SqlTableColumn#1(account.account_id as accountId)",
         },
      });

      expect(query0.$accountId).toMatchObject({
         type: "SqlSelectColumn",
         key: "accountId",
         id: "SqlSelectColumn#3(SqlQuery#2/SqlSelectColumn#1(SqlQuery#1/SqlTableColumn#1(account.account_id as accountId)))",
         query: {
            id: `SqlQuery#2`,
         },
         target: {
            key: "accountId",
            id: "SqlSelectColumn#1(SqlQuery#1/SqlTableColumn#1(account.account_id as accountId))",
         },
      });

      const ctx = new SqlBuildContext();
      ctx.scope({ query: query0 }, () => {
         query0.build(ctx, {});
      });

      expect(ctx.text).toMatchInlineSnapshot(`
        "SELECT
          "query_1"."accountId"
        FROM
          (
            SELECT
              "a_1"."account_id" AS "accountId",
              "a_1"."status"
            FROM
              "valnor_test"."account" AS "a_1"
          ) AS "query_1""
      `);
   });

   test("should return alias ids", () => {
      const ctx = new SqlBuildContext({});
      const query1 = sql`select ${val`count(*)`.as<{ total: number }>("total")} from ${Account} where ${Account.$parentId} = ${Account.out.$accountId}`;
      const query0 = sql`select ${row(Account.$$, query1.$total)} from ${Account}`;

      const actual = ctx.scope({ query: query0 }, () => {
         query0.build(ctx, {});
         return Array.from(ctx.getAliasIds(Account.out.$parentId.tableInfo));
      });
      expect(actual).toMatchObject(["SqlQuery#3/valnor_test.account", "-/valnor_test.account"]);
   });
});
