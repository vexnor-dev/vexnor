import { describe, expect, test } from "vitest";
import { sqlSelect } from "#src/core/crud/sql-select.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";
import { sql } from "#src/core/sql.js";
import { SqlSelectAll } from "#src/core/query/sql-select-all.js";
import { SqlSelectRow } from "#src/core/query/sql-select-row.js";
import { newSqlQueryColumn } from "#src/core/query/sql-query-column.js";
import { newSqlTableColumn } from "#src/core/schema/sql-table-column.js";

// ─── sqlSelect — uncovered clause branches ────────────────────────────────────

describe("sqlSelect — clause branches", () => {
   test("generates SQL with JOIN clause", () => {
      const query = sqlSelect(Account, {
         JOIN: sql`JOIN ${Order} ON ${Order.$accountId} = ${Account.$accountId}`,
      });
      const { text } = query.getSql({ params: {}, options: { dialect: "sqlite" } });
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
          "main"."account" AS "a_1" (
            /* <query_1> */
            JOIN "main"."order" AS "o_2" ON "o_2"."account_id" = "a_3"."account_id" /* </query_1> */
          ) AS "query_1"
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("generates SQL with GROUP_BY clause", () => {
      const query = sqlSelect(Account, {
         GROUP_BY: sql`${Account.$accountId}`,
      });
      const { text } = query.getSql({ params: {}, options: { dialect: "sqlite" } });
      expect(text).toContain("GROUP BY");
      expect(text).toContain("account_id");
   });

   test("generates SQL with HAVING clause", () => {
      const query = sqlSelect(Account, {
         GROUP_BY: sql`${Account.$accountId}`,
         HAVING: sql`count(*) > 1`,
      });
      const { text } = query.getSql({ params: {}, options: { dialect: "sqlite" } });
      expect(text).toContain("HAVING");
   });

   test("generates SQL with ORDER_BY clause", () => {
      const query = sqlSelect(Account, {
         ORDER_BY: sql`${Account.$createdAt} DESC`,
      });
      const { text } = query.getSql({ params: {}, options: { dialect: "sqlite" } });
      expect(text).toContain("ORDER BY");
   });

   test("throws when JOIN clause is missing join keyword", () => {
      expect(() =>
         sqlSelect(Account, {
            JOIN: sql`${Account.$accountId} = 1`,
         }),
      ).toThrow("'JOIN' criteria not including SQL keyword 'join'");
   });
});

// ─── SqlSelectRow — SqlSelectAll containing SqlQueryColumn sub-branch ─────────

describe("SqlSelectRow.getRow — SqlSelectAll with SqlQueryColumn items", () => {
   test("columns from SqlSelectAll with SqlQueryColumn entries are added to row", () => {
      const tableInfo = { name: "account", schema: "main", alias: null, out: false } as const;
      const innerQuery = sql``;

      // Build a SqlQueryColumn pointing to a table column
      const qCol = newSqlQueryColumn({
         key: "accountId",
         query: innerQuery,
         target: newSqlTableColumn({ key: "accountId", columnName: "account_id", tableInfo } as never),
      });

      // Build a SqlSelectAll whose row contains a SqlQueryColumn (not SqlTableColumn)
      const selectAll = new SqlSelectAll<{ accountId: string }>({
         innerQuery,
         row: { $accountId: qCol } as never,
      });

      const selectRow = new SqlSelectRow([selectAll]);
      const result = selectRow.getRow({ query: sql`` });
      expect(result.$accountId).toBeDefined();
   });
});

// ─── sqlSelect — with info ────────────────────────────────────────────────────

describe("sqlSelect — with info", () => {
   test("passes info to generated query", async () => {
      const { info } = await import("#src/core/charms/sql-query-info.js");
      const query = sqlSelect(Account, {}, info({ label: "findAll" }));
      expect(query).toBeDefined();
      const { text } = query.getSql({ params: {}, options: { dialect: "sqlite" } });
      expect(text).toContain("findAll");
   });
});
