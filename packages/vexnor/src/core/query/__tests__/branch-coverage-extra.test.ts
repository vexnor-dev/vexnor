import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";
import { OrderItem } from "@test-models/vexnor_dev.order-item-table.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { param, ctx } from "#/core/query/sql-param.js";
import { val } from "#/core/query/sql-select-value.js";
import { col } from "#/core/query/sql-select-column.js";
import { expand } from "#/core/query/sql-expand.js";
import { raw } from "#/core/query/sql-raw.js";
import { info } from "#/core/charms/sql-query-info.js";
import { SqlBuildError } from "#/core/sql-build-error.js";
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
      const query = sql`INSERT INTO ${Account} ${Account.insertColsVals({ accountId: "1", email: "a@b.com", firstName: "A", lastName: "B", status: "active" })} ON CONFLICT DO UPDATE SET ${excl.$email}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
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

describe("More branch coverage — expand returning SqlQuery", () => {
   test("expand handler returns SqlQuery directly", () => {
      const e = expand<{ active: boolean }>(
         { active: null },
         ({ active }) => active ? sql`WHERE status = ${"active"}` : null,
      );
      const context = new SqlBuildContext({ dialect: "sql", params: { active: true } });
      e.build(context);
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).toContain("WHERE");
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

describe("More branch coverage — charms table-update-set with object value throws", () => {
   test("updateSet throws on object value", () => {
      expect(() => {
         Account.updateSet({ email: { nested: true } } as never);
         const query = sql`UPDATE ${Account} SET ${Account.updateSet({ email: { nested: true } } as never)}`;
         const context = new SqlBuildContext({ dialect: "sql" });
         query.build(context, null, { queryType: "main" });
      }).toThrow();
   });

   test("updateSet throws on function value", () => {
      expect(() => {
         const query = sql`UPDATE ${Account} SET ${Account.updateSet({ email: (() => {}) } as never)}`;
         const context = new SqlBuildContext({ dialect: "sql" });
         query.build(context, null, { queryType: "main" });
      }).toThrow();
   });
});
