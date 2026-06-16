import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { param } from "#/core/query/sql-param.js";
import { expand } from "#/core/query/sql-expand.js";
import { raw } from "#/core/query/sql-raw.js";
import { SqlQuery } from "#/core/query/sql-query.js";

describe("SqlQuery.getSql — uncovered paths", () => {
   test("getSql with postgresql dialect", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$status} = ${param<{ status: string }>("status")}`;
      const result = query.getSql({ params: { status: "active" }, options: { dialect: "postgresql" } });
      expect(result.text).toBeDefined();
      expect(result.values).toMatchInlineSnapshot(`
        [
          "active",
        ]
      `);
   });

   test("getSql with transactsql dialect", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$status} = ${param<{ status: string }>("status")}`;
      const result = query.getSql({ params: { status: "active" }, options: { dialect: "transactsql" } });
      expect(result.text).toBeDefined();
      expect(result.values).toMatchInlineSnapshot(`
        [
          "active",
        ]
      `);
   });

   test("getSql with inline value", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$status} = ${"active"}`;
      const result = query.getSql({ options: { dialect: "postgresql" } });
      expect(result.values).toMatchInlineSnapshot(`
        [
          "active",
        ]
      `);
   });

   test("getSql with format: false skips formatting", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const result = query.getSql({ options: { dialect: "sql", format: false } });
      expect(result.text).toBeDefined();
   });

   test("getSql with expand param that returns array", () => {
      const query = sql`
         SELECT ${row(Account.$accountId)} FROM ${Account}
         WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>({ ids: null }, ({ ids }) => ids.map(id => raw(id)))})
      `;
      const result = query.getSql({ params: { ids: ["a", "b"] }, options: { dialect: "sql", format: false } });
      expect(result.text).toBeDefined();
   });

   test("getSql throws for invalid dialect", () => {
      const query = sql`SELECT 1`;
      expect(() => query.getSql({ options: { dialect: "not-a-dialect" as never } })).toThrow("Invalid dialect");
   });

   test("getSql with array param value expands to multiple placeholders", () => {
      const query = sql`
         SELECT ${row(Account.$accountId)} FROM ${Account}
         WHERE ${Account.$accountId} = ${param<{ ids: string[] }>("ids")}
      `;
      const result = query.getSql({ params: { ids: ["a", "b", "c"] }, options: { dialect: "postgresql" } });
      expect(result.values).toMatchInlineSnapshot(`
        [
          "a",
          "b",
          "c",
        ]
      `);
   });

   test("getSql throws when params not provided but required", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$accountId} = ${param<{ id: string }>("id")}`;
      expect(() => query.getSql({ options: { dialect: "sql" } } as never)).toThrow();
   });
});

describe("SqlQuery.buildInnerToken — edge cases", () => {
   test("null token produces value token", () => {
      const rawStrings = Object.assign(["SELECT ", ""], { raw: ["SELECT ", ""] }) as TemplateStringsArray;
      const query = new SqlQuery({ rawStrings, rawValues: [null] });
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      expect(context.tokens.some((t) => t.type === "value" && t.value === null)).toBe(true);
   });

   test("undefined token produces value token", () => {
      const rawStrings = Object.assign(["SELECT ", ""], { raw: ["SELECT ", ""] }) as TemplateStringsArray;
      const query = new SqlQuery({ rawStrings, rawValues: [undefined] });
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      expect(context.tokens.some((t) => t.type === "value" && t.value === null)).toBe(true);
   });
});

describe("SqlQuery.buildInnerQueryRef — format handling", () => {
   test("query rendered as CTE with 'with' format", () => {
      const sub = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const outer = sql`WITH ${sub.render("with")} SELECT * FROM ${sub.out}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      outer.build(context, null, { queryType: "main" });
      const text = context.tokens.filter((t) => t.type === "text").map((t) => t.value).join("");
      expect(text).toContain("as (");
   });

   test("query rendered as subquery with 'select' format", () => {
      const sub = sql`SELECT count(*) FROM ${Account}`;
      const outer = sql`SELECT ${sub.render("select", "inline")} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      outer.build(context, null, { queryType: "main" });
      const text = context.tokens.filter((t) => t.type === "text").map((t) => t.value).join("");
      expect(text).toContain("(");
      expect(text).toContain(") as");
   });

   test("query rendered with 'from' format", () => {
      const sub = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const outer = sql`SELECT * FROM ${sub.render("from")}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      outer.build(context, null, { queryType: "main" });
      const text = context.tokens.filter((t) => t.type === "text").map((t) => t.value).join("");
      expect(text).toContain("(");
   });
});

describe("SqlQueryRef — uncovered paths", () => {
   test("$$ on ref returns selectAll from inner query", () => {
      const query = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      const ref = query.out;
      expect(ref.$$).toBeDefined();
   });

   test("ref row returns query columns mapped to ref", () => {
      const query = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      const ref = query.out;
      expect(ref.row).toBeDefined();
      expect(ref.row.$accountId).toBeDefined();
   });

   test("ref proxy has() works for row keys", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const ref = query.render("with");
      expect("$accountId" in ref).toBe(true);
   });

   test("ref proxy getOwnPropertyDescriptor for row key", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const ref = query.render("from");
      const desc = Object.getOwnPropertyDescriptor(ref, "$accountId");
      expect(desc).toBeDefined();
   });

   test("ref proxy getOwnPropertyDescriptor for non-existent key", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const ref = query.render("from");
      const desc = Object.getOwnPropertyDescriptor(ref, "$nonExistent");
      expect(desc).toBeUndefined();
   });

   test("ref proxy get for non-existent key returns undefined", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const ref = query.render("from");
      expect((ref as unknown as Record<string, unknown>)["$nonExistent"]).toBeUndefined();
   });
});
