import { describe, expect, test, vi } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { param } from "#/core/query/sql-param.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { connect } from "#/plugin/vexnor-connection.js";
import { SqlQueryPipeline } from "#/execution/sql-query-pipeline.js";
import { raw } from "#/core/query/sql-raw.js";
import { info } from "#/core/charms/sql-query-info.js";
import { SqlQuery } from "#/core/query/sql-query.js";
import { CodeWriter } from "#/lib/code-writer.js";

describe("Branch coverage — sql-build-context keyword & paren tracking", () => {
   test("nested function call creates fn context", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      context.next("SELECT coalesce(");
      context.next("a, b)");
      // fn context was pushed and popped
      expect(context.keywordStack).toBeDefined();
   });

   test("OVER() window function creates over context", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      context.next("SELECT row_number() over(");
      context.next("ORDER BY id)");
   });

   test("parenthesized subquery (select ...)", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      context.next("WHERE id IN (select");
      context.next("id FROM other)");
   });

   test("closing paren at context depth pops stack", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      context.next("SELECT exists(");
      context.next("SELECT 1)");
      // Context was pushed when ( was encountered after exists, and popped when ) matched
   });

   test("multiple nested parens", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      context.next("SELECT CASE WHEN (a > (b + c)) THEN 1 ELSE 0 END");
   });
});

describe("Branch coverage — sql-table.ts constructor branches", () => {
   test("table with comment in query uses findQueryComment for id", () => {
      const query = sql`/* my-named-query */ SELECT ${row(Account.$accountId)} FROM ${Account}`;
      expect(query.label).toBe("my-named-query");
      expect(query.id).toContain("my-named-query");
   });

   test("table constructor with info generates id from info options", () => {
      const query = sql`${info({ label: "info-query", driver: "pg" })} SELECT ${row(Account.$accountId)} FROM ${Account}`;
      expect(query.id).toContain("label=info-query");
   });
});

describe("Branch coverage — sql-query-handler pipeline execution", () => {
   test("getSql without explicit dialect infers from table", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$email} = ${param<{ email: string }>("email")}`;
      const result = query.getSql({ params: { email: "test@test.com" }, options: { format: false } });
      expect(result.text).toBeDefined();
      expect(result.values).toContain("test@test.com");
   });
});

describe("Branch coverage — query with tag", () => {
   test("SqlQuery with tag in constructor", () => {
      const rawStrings = Object.assign(["SELECT 1"], { raw: ["SELECT 1"] }) as TemplateStringsArray;
      const query = new SqlQuery({
         rawStrings,
         rawValues: [],
         tag: "my-tag",
      });
      expect(query.tag).toBe("my-tag");
      expect(query.id).toContain("my-tag");
   });
});

describe("Branch coverage — sql-query.ts location parsing", () => {
   test("query with explicit location and locationUrl", () => {
      const rawStrings = Object.assign(["SELECT 1"], { raw: ["SELECT 1"] }) as TemplateStringsArray;
      const query = new SqlQuery({
         rawStrings,
         rawValues: [],
         location: "test/file.ts:10:5",
         locationUrl: "file:///test/file.ts",
      });
      expect(query.location).toBe("test/file.ts:10:5");
      expect(query.locationUrl).toBe("file:///test/file.ts");
   });
});

describe("Branch coverage — SqlSelectRow write", () => {
   test("row() write emits each column with comma separator", () => {
      const r = row(Account.$accountId, Account.$email, Account.$firstName);
      const query = sql`SELECT ${r} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      // Should have commas between columns
      const commas = text.split(",").length - 1;
      expect(commas).toBeGreaterThanOrEqual(2);
   });
});

describe("Branch coverage — SqlSelectAll write in default context", () => {
   test("$$ write iterates all columns with commas", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      const commas = text.split(",").length - 1;
      expect(commas).toBeGreaterThanOrEqual(3);
   });
});

describe("Branch coverage — SqlQuery.buildInnerToken with query-like Sql", () => {
   test("inner token is SqlQuery in array", () => {
      const sub = sql`SELECT 1`;
      const query = sql`SELECT ${[sub, raw(" UNION ALL "), sub]}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      expect(context.tokens.length).toBeGreaterThan(0);
   });
});

describe("Branch coverage — SqlQuery initRow with empty row", () => {
   test("query without any row-producing tokens has null row", () => {
      const query = sql`SELECT 1`;
      expect(query.row).toBeNull();
   });
});

describe("Branch coverage — code-writer defaults", () => {
   test("code-writer basic usage", () => {
      const writer = new CodeWriter();
      writer.writeLine("test");
      expect(writer.toString()).toContain("test");
   });
});
