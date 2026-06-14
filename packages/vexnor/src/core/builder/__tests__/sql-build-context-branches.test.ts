import { describe, expect, test } from "vitest";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";

describe("SqlBuildContext — addQuotes", () => {
   test("addQuotes wraps value in double quotes", () => {
      const ctx = new SqlBuildContext({});
      ctx.addQuotes("myColumn");
      expect(ctx.text).toMatchInlineSnapshot(`""myColumn""`);
   });

   test("addQuotes with multiple values", () => {
      const ctx = new SqlBuildContext({});
      ctx.addQuotes("col1", "col2");
      expect(ctx.text).toMatchInlineSnapshot(`""col1""col2""`);
   });
});

describe("SqlBuildContext — addStrings", () => {
   test("addStrings with single value", () => {
      const ctx = new SqlBuildContext({});
      ctx.addStrings("SELECT 1");
      expect(ctx.text).toMatchInlineSnapshot(`
        "SELECT
          1"
      `);
   });

   test("addStrings with multiple values", () => {
      const ctx = new SqlBuildContext({});
      ctx.addStrings("SELECT ", "1", " FROM ");
      expect(ctx.text).toMatchInlineSnapshot(`
        "SELECT
          1
        FROM"
      `);
   });
});

describe("SqlBuildContext — addValues", () => {
   test("addValues with null", () => {
      const ctx = new SqlBuildContext({});
      ctx.addValues(null);
      expect(ctx.tokens).toMatchInlineSnapshot(`
        [
          {
            "type": "value",
            "value": null,
          },
        ]
      `);
   });

   test("addValues with undefined (becomes null)", () => {
      const ctx = new SqlBuildContext({});
      ctx.addValues(undefined);
      expect(ctx.tokens).toMatchInlineSnapshot(`
        [
          {
            "type": "value",
            "value": null,
          },
        ]
      `);
   });

   test("addValues with primitives", () => {
      const ctx = new SqlBuildContext({});
      ctx.addValues("hello", 42, true);
      expect(ctx.tokens).toMatchInlineSnapshot(`
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
            "value": true,
          },
        ]
      `);
   });
});

describe("SqlBuildContext — getAlias", () => {
   test("generates alias from table name parts", () => {
      const ctx = new SqlBuildContext({});
      const alias = ctx.getAlias({ name: "user_account", schema: "public", out: false });
      expect(alias).toMatchInlineSnapshot(`"ua_1"`);
   });

   test("returns explicit alias when provided", () => {
      const ctx = new SqlBuildContext({});
      const alias = ctx.getAlias({ name: "account", schema: "main", alias: "myAlias", out: false });
      expect(alias).toMatchInlineSnapshot(`"myAlias"`);
   });

   test("returns cached alias on second call", () => {
      const ctx = new SqlBuildContext({});
      const first = ctx.getAlias({ name: "account", schema: "main", out: false });
      const second = ctx.getAlias({ name: "account", schema: "main", out: false });
      expect(first).toBe(second);
   });

   test("increments alias counter for different tables", () => {
      const ctx = new SqlBuildContext({});
      const a1 = ctx.getAlias({ name: "account", schema: "main", out: false });
      const a2 = ctx.getAlias({ name: "order", schema: "main", out: false });
      expect(a1).toMatchInlineSnapshot(`"a_1"`);
      expect(a2).toMatchInlineSnapshot(`"o_2"`);
   });
});

describe("SqlBuildContext — getQueryName", () => {
   test("assigns sequential query names", () => {
      const ctx = new SqlBuildContext({});
      const q1 = sql`SELECT 1`;
      const q2 = sql`SELECT 2`;
      const name1 = ctx.getQueryName(q1);
      const name2 = ctx.getQueryName(q2);
      expect(name1).toMatchInlineSnapshot(`"query_0"`);
      expect(name2).toMatchInlineSnapshot(`"query_1"`);
   });

   test("returns same name for same query", () => {
      const ctx = new SqlBuildContext({});
      const q = sql`SELECT 1`;
      const name1 = ctx.getQueryName(q);
      const name2 = ctx.getQueryName(q);
      expect(name1).toBe(name2);
   });
});

describe("SqlBuildContext — keyword tracking", () => {
   test("keyword is undefined initially", () => {
      const ctx = new SqlBuildContext({});
      expect(ctx.keyword).toBeUndefined();
   });

   test("keyword tracks major keywords from next()", () => {
      const ctx = new SqlBuildContext({});
      ctx.next("select foo from bar");
      expect(ctx.keyword).toMatchInlineSnapshot(`"from"`);
   });

   test("keyword tracks WHERE", () => {
      const ctx = new SqlBuildContext({});
      ctx.next("select x from y where");
      expect(ctx.keyword).toMatchInlineSnapshot(`"where"`);
   });

   test("keywords() iterator yields major keywords in reverse", () => {
      const ctx = new SqlBuildContext({});
      ctx.next("select x from y where z");
      const kws = [...ctx.keywords()];
      expect(kws).toMatchInlineSnapshot(`
        [
          "where",
          "from",
          "select",
        ]
      `);
   });
});

describe("SqlBuildContext — scope tracking", () => {
   test("scope sets query and restores on exit for main", () => {
      const ctx = new SqlBuildContext({});
      const q = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      let innerQuery = undefined;
      ctx.scope(q, () => {
         innerQuery = ctx.query;
      }, { queryType: "main" });
      expect(innerQuery).toBe(q);
      expect(ctx.query).toBeUndefined();
   });

   test("scope with inline does not push query stack", () => {
      const ctx = new SqlBuildContext({});
      const q = sql`SELECT 1`;
      ctx.scope(q, () => {
         expect(ctx.query).toBeUndefined();
      }, { queryType: "inline" });
   });

   test("isCTE returns false for non-CTE query", () => {
      const ctx = new SqlBuildContext({});
      const q = sql`SELECT 1`;
      ctx.scope(q, () => {}, { queryType: "main", cte: false });
      expect(ctx.isCTE(q)).toBe(false);
   });

   test("isCTE returns true for CTE query", () => {
      const ctx = new SqlBuildContext({});
      const q = sql`SELECT 1`;
      ctx.scope(q, () => {}, { queryType: "main", cte: true });
      expect(ctx.isCTE(q)).toBe(true);
   });

   test("isCTE throws for unregistered query", () => {
      const ctx = new SqlBuildContext({});
      const q = sql`SELECT 1`;
      expect(() => ctx.isCTE(q)).toThrow();
   });
});

describe("SqlBuildContext — addParam", () => {
   test("addParam adds param token", () => {
      const ctx = new SqlBuildContext({});
      ctx.addParam({ name: "userId" });
      expect(ctx.tokens).toMatchInlineSnapshot(`
        [
          {
            "name": "userId",
            "type": "param",
          },
        ]
      `);
   });
});

describe("SqlBuildContext — text with non-primitive value throws", () => {
   test("throws for non-primitive value in text getter", () => {
      const ctx = new SqlBuildContext({});
      ctx.addValues({ obj: true } as never);
      expect(() => ctx.text).toThrow("Unexpected non-primitive value token");
   });
});
