import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { insert } from "#/core/operators/sql-insert-x.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { AccountStatusUdt } from "@test-models/vexnor_dev-enums.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { newSqlTable } from "#/core/schema/sql-table.js";
import { excluded } from "#/core/schema/sql-excluded.js";

describe("More branch coverage — sql-table.ts constructor branches", () => {
   test("table without schema", () => {
      const table = newSqlTable({
         tableInfo: { name: "items" },
         pk: ["id"],
         columns: { id: "id", name: "name" } as Record<string, string>,
         crud: {} as never,
      });
      expect(table.tableInfo.schema).toBeUndefined();
      const context = new SqlBuildContext({ dialect: "sql" });
      const query = sql`SELECT * FROM ${table}`;
      query.build(context, null, { queryType: "main" });
      expect(context.tokens.length).toBeGreaterThan(0);
   });

   test("table with alias in schema.tableName AS tableAlias format (same name)", () => {
      // When name === alias, it should not emit "as"
      const table = newSqlTable({
         tableInfo: { name: "accounts", schema: "public" },
         pk: ["id"],
         columns: { id: "id" } as Record<string, string>,
         crud: {} as never,
      });
      const rendered = table.render("schema.tableName AS tableAlias");
      const context = new SqlBuildContext({ dialect: "sql" });
      const query = sql`SELECT * FROM ${rendered}`;
      query.build(context, null, { queryType: "main" });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      // When no alias is set and name matches, should just output the table name
      expect(text).toContain("accounts");
   });
});

describe("More branch coverage — sql-query-column write formats", () => {
   test("tableName.columnAlias format", () => {
      const sub = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const colRendered = sub.$accountId.render("tableName.columnAlias");
      const outer = sql`SELECT ${row(colRendered)} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      outer.build(context, null, { queryType: "main" });
      expect(context.tokens.length).toBeGreaterThan(0);
   });

   test("columnAlias format", () => {
      const sub = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const colRendered = sub.$accountId.render("columnAlias");
      const outer = sql`SELECT ${row(colRendered)} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      outer.build(context, null, { queryType: "main" });
      expect(context.tokens.length).toBeGreaterThan(0);
   });

   test("tableAlias.columnName format", () => {
      const sub = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const colRendered = sub.$accountId.render("tableAlias.columnName");
      const outer = sql`SELECT ${row(colRendered)} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      outer.build(context, null, { queryType: "main" });
      expect(context.tokens.length).toBeGreaterThan(0);
   });

   test("tableAlias.columnName AS columnAlias with alias key", () => {
      const sub = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const colRendered = sub.$accountId.as("myId").render("tableAlias.columnName AS columnAlias");
      const outer = sql`SELECT ${row(colRendered)} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      outer.build(context, null, { queryType: "main" });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).toContain("as");
   });

   test("tableName.columnName AS columnAlias with alias", () => {
      const sub = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const colRendered = sub.$accountId.as("myId").render("tableName.columnName AS columnAlias");
      const outer = sql`SELECT ${row(colRendered)} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      outer.build(context, null, { queryType: "main" });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).toContain("as");
   });

   test("tableName.columnName format (no alias)", () => {
      const sub = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const colRendered = sub.$accountId.render("tableName.columnName");
      const outer = sql`SELECT ${row(colRendered)} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      outer.build(context, null, { queryType: "main" });
      expect(context.tokens.length).toBeGreaterThan(0);
   });

   test("columnName format (no alias)", () => {
      const sub = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const colRendered = sub.$accountId.render("columnName");
      const outer = sql`SELECT ${row(colRendered)} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      outer.build(context, null, { queryType: "main" });
      expect(context.tokens.length).toBeGreaterThan(0);
   });
});

describe("More branch coverage — sql-table-column write formats", () => {
   test("tableAlias.columnName AS columnAlias for aliased table column", () => {
      const aliased = Account.as("a");
      const col = aliased.$accountId.as("id");
      const query = sql`SELECT ${row(col)} FROM ${aliased}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).toContain("as");
   });

   test("excluded column uses rawAlias.columnName format", () => {
      const excl = excluded(Account);
      const query = sql`INSERT INTO ${Account} ${insert(Account, "rows")} ON CONFLICT DO UPDATE SET ${excl.$email}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main", params: { rows: [{ accountId: "1", email: "a@b.com", firstName: "A", lastName: "B", status: AccountStatusUdt.CREATED }] } });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).toContain("EXCLUDED");
   });
});

describe("More branch coverage — sql-query initRow with SqlSelectAll from subquery", () => {
   test("row with query.$$ (SqlSelectAll from query)", () => {
      const sub = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      // sub.$$ is SqlSelectAll — passing it to row() triggers the SqlSelectAll case
      const query = sql`SELECT ${row(sub.$$)} FROM ${sub.out}`;
      expect(query.row).toBeDefined();
   });
});

describe("More branch coverage — sql-query-handler default mode arg", () => {
   test("SqlQuery.getSql uses inferred dialect from table", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      // Without explicit dialect, it infers from the table's dialect
      const result = query.getSql({ options: { format: false } });
      expect(result.text).toBeDefined();
   });
});


