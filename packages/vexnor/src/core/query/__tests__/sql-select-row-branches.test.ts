import { describe, expect, test } from "vitest";
import { SqlSelectRow, row } from "#/core/query/sql-select-row.js";
import { SqlSelectValue } from "#/core/query/sql-select-value.js";
import { col } from "#/core/query/sql-select-column.js";
import { sql } from "#/core/sql.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";

describe("SqlSelectRow.getRow() — SqlSelectValue branch", () => {
   test("SqlSelectValue entries produce query columns in row", () => {
      const inner = sql`COUNT(*)`;
      const v = new SqlSelectValue<{ Key: "total"; Type: number }>({ key: "total", innerQuery: inner });
      const selectRow = new SqlSelectRow([v]);
      const result = selectRow.getRow({ query: sql`` });
      expect(result.$total!).toBeDefined();
      expect(result.$total!.key).toBe("total");
   });
});

describe("SqlSelectRow.getRow() — SqlSelectColumn branch", () => {
   test("SqlSelectColumn entries produce query columns in row", () => {
      const c = col<{ status: string }>("status");
      const selectRow = new SqlSelectRow([c]);
      const result = selectRow.getRow({ query: sql`` });
      expect(result.$status!).toBeDefined();
      expect(result.$status!.key).toBe("status");
   });
});

describe("SqlSelectRow.getRow() — caching", () => {
   test("returns cached row on second call with same query", () => {
      const query = sql`select ${row(Account.$accountId)} from ${Account}`;
      const first = query.row;
      const second = query.row;
      expect(first).toBe(second);
   });
});

describe("SqlSelectRow.getRow() — SqlTableAll path", () => {
   test("SqlTableAll produces columns from table.$$", () => {
      const selectRow = row(Account.$$);
      const result = selectRow.getRow({ query: sql`` });
      expect(result.$accountId).toBeDefined();
      expect(result.$email).toBeDefined();
      expect(result.$firstName).toBeDefined();
   });
});

describe("SqlSelectRow.getRow() — SqlTableColumn direct path", () => {
   test("individual SqlTableColumns are added to row", () => {
      const selectRow = row(Account.$accountId, Account.$email);
      const result = selectRow.getRow({ query: sql`` });
      expect(result.$accountId!).toBeDefined();
      expect(result.$email!).toBeDefined();
   });
});

describe("SqlSelectRow.write()", () => {
   test("emits comma-separated columns", () => {
      const selectRow = row(Account.$accountId, Account.$email);
      const ctx = new SqlBuildContext({});
      selectRow.build(ctx);
      expect(ctx.text).toContain(",");
   });
});
