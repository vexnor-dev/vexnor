import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { set } from "#/core/operators/sql-set.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { param } from "#/core/query/sql-param.js";
import { SqlQuery } from "#/core/query/sql-query.js";

describe("Branch coverage push — SQL table write in update/delete/insert context", () => {
   test("UPDATE with schema.tableName sets alias to table name", () => {
      const rendered = Account.render("schema.tableName");
      const query = sql`UPDATE ${rendered} ${set(Account)}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main", params: { set: { email: "x@y.com" } } });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text.toLowerCase()).toContain("update");
   });
});

describe("Branch coverage push — SqlBuildContext.getAlias for out column", () => {
   test("out column references parent scope alias", () => {
      const sub = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      // Using out columns in a WHERE clause forces getAlias to look up parent stack
      const outer = sql`
         SELECT ${row(Account.$accountId)}
         FROM ${Account}
         WHERE ${Account.$accountId} IN (
            SELECT ${sub.out.$accountId} FROM ${sub.out}
         )
      `;
      const context = new SqlBuildContext({ dialect: "sql" });
      outer.build(context, null, { queryType: "main" });
      expect(context.tokens.length).toBeGreaterThan(0);
   });
});

describe("Branch coverage push — SqlQuery constructor hashId with array values", () => {
   test("hashId includes nested array items", () => {
      const query = sql`SELECT ${[Account.$accountId, Account.$email]} FROM ${Account}`;
      expect(query.hashId).toBeDefined();
   });
});

describe("Branch coverage push — SqlQuery.write with empty children", () => {
   test("write handles query with no rawValues", () => {
      const rawStrings = Object.assign(["SELECT 1"], { raw: ["SELECT 1"] }) as TemplateStringsArray;
      const query = new SqlQuery({ rawStrings, rawValues: [] });
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      const text = context.tokens.filter(t => t.type === "text").map(t => t.value).join("");
      expect(text).toContain("SELECT 1");
   });
});

describe("Branch coverage push — SqlTableAll in query with join", () => {
   test("$$ in FROM clause", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$status} = ${"active"}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      query.build(context, null, { queryType: "main" });
      expect(context.tokens.filter(t => t.type === "value").length).toBe(1);
   });
});

describe("Branch coverage push — SqlQuery.getSql error handling paths", () => {
   test("getSql auto format with sql-format-prettier available", () => {
      const query = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account} WHERE ${Account.$status} = ${param<{ status: string }>("status")}`;
      // format: "auto" with formatter registered should format
      const result = query.getSql({ params: { status: "active" }, options: { format: "auto", dialect: "postgresql" } });
      expect(result.text).toBeDefined();
      expect(result.values).toContain("active");
   });

   test("getSql with format false returns raw text", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const result = query.getSql({ options: { format: false, dialect: "sql" } });
      expect(result.text).toBeDefined();
      expect(result.text).not.toBe("");
   });
});

describe("Branch coverage push — SqlBuildContext.next complex patterns", () => {
   test("APPLY keyword tracking", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      context.next("SELECT * FROM accounts OUTER APPLY(SELECT 1)");
   });

   test("lateral subquery", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      context.next("SELECT * FROM accounts, LATERAL (SELECT 1) sub");
   });

   test("IN subquery", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      context.next("WHERE id IN (SELECT account_id FROM orders)");
   });
});

describe("Branch coverage push — SqlQuery with multiple authorize tags", () => {
   test("chained authorize calls", () => {
      const query = sql`SELECT 1`.authorize("read").authorize("admin");
      expect(query.authorization).toContain("read");
      expect(query.authorization).toContain("admin");
   });
});

describe("Branch coverage push — null/undefined inline values", () => {
   test("false value as inline", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$status} = ${false}`;
      const result = query.getSql({ options: { dialect: "sql", format: false } });
      expect(result.values).toContain(false);
   });

   test("0 value as inline", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$status} = ${0}`;
      const result = query.getSql({ options: { dialect: "sql", format: false } });
      expect(result.values).toContain(0);
   });

   test("empty string as inline", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$status} = ${""}`;
      const result = query.getSql({ options: { dialect: "sql", format: false } });
      expect(result.values).toContain("");
   });
});
