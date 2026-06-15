import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { param } from "#/core/query/sql-param.js";
import { val } from "#/core/query/sql-select-value.js";
import { col } from "#/core/query/sql-select-column.js";
import { expand } from "#/core/query/sql-expand.js";
import { raw } from "#/core/query/sql-raw.js";
import { SqlBuildError } from "#/core/sql-build-error.js";

describe("Branch coverage — sql-select-row edge cases", () => {
   test("row with SqlTableAll column type", () => {
      // This triggers the SqlTableAll branch in getRow
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      expect(query.row).toBeDefined();
      const rowKeys = Object.keys(query.row);
      expect(rowKeys.length).toBeGreaterThan(1);
   });

   test("row with SqlQueryColumn from subquery", () => {
      const sub = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      const query = sql`SELECT ${row(sub.out.$accountId)} FROM ${sub.out}`;
      expect(query.row).toBeDefined();
   });

   test("row with val (SqlSelectValue)", () => {
      const v = val`count(*)`.as<{ cnt: number }>("cnt");
      const query = sql`SELECT ${row(Account.$accountId, v)} FROM ${Account} GROUP BY ${Account.$accountId}`;
      expect(query.row).toBeDefined();
      expect(query.row.$cnt).toBeDefined();
   });

   test("row with col (SqlSelectColumn)", () => {
      const c = col<{ total: number }>("total");
      const query = sql`SELECT ${row(Account.$accountId, c)} FROM ${Account}`;
      expect(query.row).toBeDefined();
      expect(query.row.$total).toBeDefined();
   });
});

describe("Branch coverage — sql-select-value", () => {
   test("val with template literal", () => {
      const v = val`COALESCE(x, 0)`.as<{ x: number }>("x");
      expect(v.key).toBe("x");
      expect(v.params).toBeDefined();
   });

   test("val with non-SqlQuery non-array throws", () => {
      expect(() => val(42 as never).as<{ x: number }>("x")).toThrow();
   });
});

describe("Branch coverage — sql-build-context keyword tracking", () => {
   test("next() with CROSS APPLY", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      context.next("SELECT * FROM accounts CROSS APPLY(");
      context.next("SELECT 1)");
   });

   test("next() with nested parenthesized subquery", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      context.next("WHERE id IN (SELECT id FROM other)");
   });

   test("context keyword on empty stack", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      expect(context.keyword).toBeUndefined();
   });
});

describe("Branch coverage — expand with context params and return values", () => {
   test("expand handler returning single Sql item", () => {
      const e = expand<{ mode: string }>({ mode: null }, ({ mode }) => raw(mode));
      const context = new SqlBuildContext({ dialect: "sql", params: { mode: "active" } });
      e.build(context);
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).toContain("active");
   });

   test("expand with boundary comments", () => {
      const e = expand<{ ids: string[] }>({ ids: null }, ({ ids }) => ids.map(id => raw(id)));
      const context = new SqlBuildContext({ dialect: "sql" });
      e.build(context, { boundaryComments: true });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).toContain("/*");
   });

   test("expand handler returning SqlQuery inlines it", () => {
      const e = expand<{ filter: boolean }>({ filter: null }, ({ filter }) =>
         filter ? sql`WHERE 1=1`.inline() : null
      );
      const context = new SqlBuildContext({ dialect: "sql", params: { filter: true } });
      e.build(context);
      expect(context.tokens.length).toBeGreaterThan(0);
   });
});

describe("Branch coverage — sql-table write formats", () => {
   test("table with schema.tableName AS tableAlias format (same name = no alias shown)", () => {
      const rendered = Account.render("schema.tableName AS tableAlias");
      const context = new SqlBuildContext({ dialect: "sql" });
      const query = sql`SELECT ${row(Account.$$)} FROM ${rendered}`;
      query.build(context, null, { queryType: "main" });
      expect(context.tokens.length).toBeGreaterThan(0);
   });

   test("table with tableAlias format", () => {
      const rendered = Account.render("tableAlias");
      const context = new SqlBuildContext({ dialect: "sql" });
      const query = sql`SELECT ${row(Account.$$)} FROM ${rendered}`;
      query.build(context, null, { queryType: "main" });
      expect(context.tokens.length).toBeGreaterThan(0);
   });

   test("aliased table in query", () => {
      const aliased = Account.as("a");
      const query = sql`SELECT ${row(aliased.$$)} FROM ${aliased}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text.length).toBeGreaterThan(0);
   });
});

describe("Branch coverage — table column write formats", () => {
   test("column with tableAlias.columnName format via aliased table", () => {
      const aliased = Account.as("a");
      const query = sql`SELECT ${row(aliased.$accountId)} FROM ${aliased}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).toContain("a");
   });
});

describe("Branch coverage — table update set with Date", () => {
   test("updateSet with Date value", () => {
      const d = new Date("2024-01-01");
      const query = sql`UPDATE ${Account} SET ${Account.updateSet({ createdAt: d } as never)}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      expect(context.tokens.some(t => t.type === "value" && t.value instanceof Date)).toBe(true);
   });
});

describe("Branch coverage — insert with multiple rows", () => {
   test("insertColsVals with two rows", () => {
      const query = sql`INSERT INTO ${Account} ${Account.insertColsVals(
         { accountId: "1", email: "a@b.com", firstName: "A", lastName: "B", status: "active" },
         { accountId: "2", email: "c@d.com", firstName: "C", lastName: "D", status: "inactive" },
      )}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      const valueTokens = context.tokens.filter(t => t.type === "value");
      expect(valueTokens.length).toBe(10); // 5 cols * 2 rows
   });
});

describe("Branch coverage — query write with boundaryComments disabled", () => {
   test("write without boundary comments", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, { boundaryComments: false }, { queryType: "main" });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).not.toContain("/*");
   });
});
