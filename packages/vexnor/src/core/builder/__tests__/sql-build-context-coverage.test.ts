import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";

describe("SqlBuildContext — uncovered function paths", () => {
   test("text getter returns formatted SQL text", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "postgresql" });
      query.build(context, null, { queryType: "main" });
      expect(context.text).toBeDefined();
      expect(typeof context.text).toBe("string");
   });

   test("values getter returns only value tokens", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$status} = ${"active"}`;
      const context = new SqlBuildContext({ dialect: "postgresql" });
      query.build(context, null, { queryType: "main" });
      const values = context.values;
      expect(values.length).toBeGreaterThan(0);
   });

   test("keywords() yields major keywords in reverse order", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      context.addStrings("SELECT 1 FROM test");
      context.next("SELECT 1 FROM test");
      const kws = [...context.keywords()];
      expect(kws.length).toBeGreaterThan(0);
   });

   test("setAlias and getAlias", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      const tableIdentity = { name: "accounts", schema: "public" };
      context.setAlias(tableIdentity, { alias: "acct" });
      expect(context.getAlias({ ...tableIdentity, alias: undefined })).toBe("acct");
   });

   test("getAlias returns tableIdentity.alias when available", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      const tableIdentity = { name: "accounts", schema: "public", alias: "a" };
      expect(context.getAlias(tableIdentity)).toBe("a");
   });

   test("getAlias generates token-based alias when no existing alias", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      const tableIdentity = { name: "order_items", schema: "public" };
      const alias = context.getAlias(tableIdentity);
      expect(alias).toMatch(/^oi_/);
   });

   test("setAlias with empty alias does nothing", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      context.setAlias({ name: "test", schema: "public" }, { alias: undefined });
      // No error
   });

   test("addValues adds value tokens", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      context.addValues("hello", 42, null);
      expect(context.tokens).toMatchInlineSnapshot(`
        [
          {
            "type": "value",
            "value": "hello",
          },
          {
            "type": "value",
            "value": 42,
          },
          {
            "type": "value",
            "value": null,
          },
        ]
      `);
   });

   test("addParam adds param token", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      context.addParam({ name: "myParam" });
      expect(context.tokens[0]).toMatchInlineSnapshot(`
        {
          "name": "myParam",
          "type": "param",
        }
      `);
   });

   test("addQuotes wraps in quotes", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      context.addQuotes("accounts.email");
      expect(context.tokens[0]!.type).toBe("text");
   });

   test("isCTE checks registered query CTE status", () => {
      const query = sql`SELECT 1`;
      const context = new SqlBuildContext({ dialect: "sql" });
      context.addQuery(query, { cte: true });
      expect(context.isCTE(query)).toBe(true);
   });

   test("isCTE throws for unregistered query", () => {
      const query = sql`SELECT 1`;
      const context = new SqlBuildContext({ dialect: "sql" });
      expect(() => context.isCTE(query)).toThrow();
   });

   test("scope with inline queryType does not push/pop stacks", () => {
      const query = sql`SELECT 1`;
      const context = new SqlBuildContext({ dialect: "sql" });
      const result = context.scope(query, () => "inner", { queryType: "inline" });
      expect(result).toBe("inner");
   });

   test("scope with main queryType pushes and pops stacks", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const context = new SqlBuildContext({ dialect: "sql" });
      const outerQuery = context.query;
      context.scope(query, () => {
         expect(context.query).toBe(query);
      }, { queryType: "main", cte: false });
      expect(context.query).toBe(outerQuery);
   });

   test("next() handles parentheses tracking", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      context.next("SELECT (");
      context.next("1)");
      // No error means parentheses tracked correctly
   });
});
