import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { classCounters } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";

describe("SqlBuildContextRowTokens", () => {
   test("should identify row token from 2-level query", () => {
      const query1 = sql`select ${row(Account.$accountId, Account.$status)} from ${Account}`;
      const query0 = sql`select ${row(query1.$accountId)} from ${query1}`;
      expect(classCounters).toMatchInlineSnapshot(`
        Map {
          "SqlTableColumn" => 9,
          "SqlSelectRow" => 2,
          "SqlQuery" => 2,
          "SqlQueryColumn" => 2,
        }
      `);

      expect(query1.$accountId).toMatchObject({
         type: "SqlQueryColumn",
         key: "accountId",
         id: "SqlQueryColumn#1(SqlQuery#1/SqlTableColumn#1(account.account_id as accountId))",
         query: {
            id: `SqlQuery#1`,
         },
         target: {
            key: "accountId",
            id: "SqlTableColumn#1(account.account_id as accountId)",
         },
      });

      expect(query0.$accountId).toMatchObject({
         type: "SqlQueryColumn",
         key: "accountId",
         id: "SqlQueryColumn#3(SqlQuery#2/SqlQueryColumn#1(SqlQuery#1/SqlTableColumn#1(account.account_id as accountId)))",
         query: {
            id: `SqlQuery#2`,
         },
         target: {
            key: "accountId",
            id: "SqlQueryColumn#1(SqlQuery#1/SqlTableColumn#1(account.account_id as accountId))",
         },
      });

      const ctx = new SqlBuildContext();
      query0.build(ctx, {});

      expect(ctx.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "query_1"."accountId"
        FROM
          (
            /* <query_1> */
            SELECT
              "a_1"."account_id" AS "accountId",
              "a_1"."status"
            FROM
              "main"."account" AS "a_1" /* </query_1> */
          ) AS "query_1" /* </query_0> */"
      `);
   });
});
