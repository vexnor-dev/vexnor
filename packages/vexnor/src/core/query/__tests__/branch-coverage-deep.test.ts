import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { val } from "#/core/query/sql-select-value.js";
import { col } from "#/core/query/sql-select-column.js";

describe("Branch coverage — SqlSelectRow.getRow() all switch cases", () => {
   test("getRow with SqlTableAll (Account.$$)", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      expect(query.row).toBeDefined();
      expect(Object.keys(query.row).length).toBeGreaterThan(3);
   });

   test("getRow with SqlTableColumn (Account.$email)", () => {
      const query = sql`SELECT ${row(Account.$email)} FROM ${Account}`;
      expect(query.row.$email).toBeDefined();
   });

   test("getRow with SqlSelectValue (val)", () => {
      const v = val`count(*)`.as<{ cnt: number }>("cnt");
      const query = sql`SELECT ${row(v)} FROM ${Account}`;
      expect(query.row.$cnt).toBeDefined();
   });

   test("getRow with SqlSelectColumn (col)", () => {
      const c = col<{ status: string }>("status");
      const query = sql`SELECT ${row(c)} FROM ${Account}`;
      expect(query.row.$status).toBeDefined();
   });

   test("getRow with SqlQueryColumn from subquery out", () => {
      const sub = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      const query = sql`SELECT ${row(sub.out.$accountId, sub.out.$email)} FROM ${sub.out}`;
      expect(query.row.$accountId).toBeDefined();
      expect(query.row.$email).toBeDefined();
   });

   test("getRow caches by query id", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const row1 = query.row;
      const row2 = query.row;
      expect(row1).toBe(row2);
   });
});

describe("Branch coverage — SqlTable write() format branches", () => {
   test("schema.tableName format", () => {
      const rendered = Account.render("schema.tableName");
      const query = sql`SELECT 1 FROM ${rendered}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      expect(context.tokens.length).toBeGreaterThan(0);
   });

   test("schema.tableName AS tableAlias with alias", () => {
      const aliased = Account.as("acct");
      const rendered = aliased.render("schema.tableName AS tableAlias");
      const query = sql`SELECT 1 FROM ${rendered}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).toContain("as");
   });

   test("schema.tableName in UPDATE context sets alias", () => {
      const rendered = Account.render("schema.tableName");
      const query = sql`UPDATE ${rendered} SET ${Account.updateSet({ email: "new@test.com" })}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      expect(context.tokens.length).toBeGreaterThan(0);
   });

   test("tableName format only", () => {
      const rendered = Account.render("tableName");
      const query = sql`SELECT 1 FROM ${rendered}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      expect(context.tokens.length).toBeGreaterThan(0);
   });

   test("tableAlias format", () => {
      const rendered = Account.render("tableAlias");
      const query = sql`SELECT 1 FROM ${rendered}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      expect(context.tokens.length).toBeGreaterThan(0);
   });
});

describe("Branch coverage — SqlTableColumn write() format branches", () => {
   test("default format with alias (tableName.columnName AS columnAlias)", () => {
      const aliased = Account.$accountId.as("id");
      const query = sql`SELECT ${row(aliased)} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).toContain("as");
   });

   test("column in subquery output uses tableAlias format", () => {
      const aliased = Account.as("a");
      const query = sql`SELECT ${row(aliased.$accountId, aliased.$email)} FROM ${aliased}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      expect(context.tokens.length).toBeGreaterThan(0);
   });
});

describe("Branch coverage — SqlQueryColumn write() switch cases", () => {
   test("column with different format via render()", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const col = query.$accountId;
      const columnNameFormat = col.render("columnName");
      const context = new SqlBuildContext({ dialect: "sql" });
      const q2 = sql`SELECT ${row(columnNameFormat)} FROM ${Account}`;
      q2.build(context, null, { queryType: "main" });
      expect(context.tokens.length).toBeGreaterThan(0);
   });

   test("SqlQueryColumn.as() in query", () => {
      const sub = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      const outer = sql`SELECT ${row(sub.out.$accountId.as("id"))} FROM ${sub.out}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      outer.build(context, null, { queryType: "main" });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).toContain("id");
   });
});

describe("Branch coverage — SqlBuildContext.getAlias out path", () => {
   test("getAlias for out column traverses parent stack", () => {
      const sub = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const outer = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$accountId} = ${sub.out.$accountId}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      outer.build(context, null, { queryType: "main" });
      expect(context.tokens.length).toBeGreaterThan(0);
   });
});
