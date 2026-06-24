import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { when } from "#/core/operators/sql-when.js";
import { eachObject, eachKey, colInTable } from "#/core/operators/sql-each-object.js";
import { raw } from "#/core/query/sql-raw.js";
import { expandFromClause } from "#/core/crud/sql-select.js";
import { newSqlQueryHandler } from "#/core/query/sql-query-handler.js";
import { MockQueryHandler } from "#/test/mock-query-handler.js";
import { filterBy } from "#/core/operators/sql-filter-by.js";

describe("sql-each-object — non-SqlQuery body in colInTable (line 129)", () => {
   test("direct build: colInTable with raw() body hits else branch", () => {
      const body = raw("= ?");
      const gate = colInTable(Account, eachKey(), body);
      const context = new SqlBuildContext({ dialect: "postgresql", params: {} }) as any;
      context._eachObjectCurrentKey = "email";
      context._eachObjectCurrentValue = "val";
      context._eachObjectTable = null;
      (gate as any).write(context);
      const textTokens = context.tokens.filter((t: any) => t.type === "text");
      expect(textTokens.some((t: any) => t.value === "= ?")).toBe(true);
   });

   test("colInTable gate skips invalid columns (line 122)", () => {
      const body = raw("= ?");
      const gate = colInTable(Account, eachKey(), body);
      const context = new SqlBuildContext({ dialect: "postgresql", params: {} }) as any;
      context._eachObjectCurrentKey = "invalidCol";
      context._eachObjectCurrentValue = "skip";
      context._eachObjectTable = null;
      const tokensBefore = context.tokens.length;
      (gate as any).write(context);
      // Gate returns early — no tokens added
      expect(context.tokens.length).toBe(tokensBefore);
   });
});

describe("sql-each-object — non-SqlQuery template in eachObject (line 222)", () => {
   test("direct build: eachObject with raw() template hits else branch", () => {
      const eachObj = eachObject<{ vals: Record<string, unknown> }>("vals", raw("?"));
      const context = new SqlBuildContext({ dialect: "postgresql", params: { vals: { a: "1", b: "2" } } });
      (eachObj as any).write(context);
      const textTokens = (context as any).tokens.filter((t: any) => t.type === "text");
      expect(textTokens.filter((t: any) => t.value === "?").length).toBe(2);
   });
});

describe("sql-when — negate in serialize mode (line 106)", () => {
   test("negated when serializes with negate: true in operator token", () => {
      const query = sql`SELECT 1 ${when("!hideEmail", sql`AND email IS NOT NULL`)}`;
      const context = new SqlBuildContext({ dialect: "postgresql", params: null });
      query.build(context, null, { queryType: "main" });
      const op = context.tokens.find((t) => t.type === "operator") as any;
      expect(op.operator.negate).toBe(true);
   });
});

describe("sql-when — buildBranchTokens non-SqlQuery (line 137)", () => {
   test("raw() branches in serialize mode hit else path in buildBranchTokens", () => {
      const query = sql`SELECT 1 ORDER BY x ${when("sortAsc", raw("ASC"), raw("DESC"))}`;
      const context = new SqlBuildContext({ dialect: "postgresql", params: null });
      query.build(context, null, { queryType: "main" });
      const op = context.tokens.find((t) => t.type === "operator") as any;
      expect(op.operator.onTrue).toMatchInlineSnapshot(`
        [
          {
            "type": "text",
            "value": "ASC",
          },
        ]
      `);
      expect(op.operator.onFalse).toMatchInlineSnapshot(`
        [
          {
            "type": "text",
            "value": "DESC",
          },
        ]
      `);
   });
});

describe("sql-query-handler — validateParams (line 266)", () => {
   test("invalid filterBy column throws", async () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`;
      const handler = newSqlQueryHandler(new MockQueryHandler(query));
      await expect(
         handler.all({ db: { query: async () => ({ rows: [] }) } as any, params: { filterBy: { nonExistent: "x" } as any } }),
      ).rejects.toThrow();
   });

   test("valid filterBy column passes validation", async () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`;
      const handler = newSqlQueryHandler(new MockQueryHandler(query));
      const result = await handler.all({
         db: { query: async () => ({ rows: [] }) } as any,
         params: { filterBy: { email: "x@test.com" } },
      });
      expect(result).toMatchInlineSnapshot(`[]`);
   });
});

describe("sql-query-handler — proxy fallthrough (lines 390-391)", () => {
   test("proxy get returns source property", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const handler = newSqlQueryHandler(new MockQueryHandler(query)) as any;
      expect("hash" in handler).toBe(true);
      expect(handler.hash).toBeDefined();
   });

   test("proxy get returns undefined for unknown property", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const handler = newSqlQueryHandler(new MockQueryHandler(query)) as any;
      expect(handler.totallyFakeProperty).toBeUndefined();
   });
});

describe("sql-build-context — operator token in text getter", () => {
   test("addOperator renders as comment", () => {
      const context = new SqlBuildContext({ dialect: "postgresql" });
      context.addStrings("SELECT 1 WHERE ");
      context.addOperator({ type: "filter", columns: {}, param: "filterBy" });
      expect(context.text).toMatchInlineSnapshot(`
        "SELECT
          1
        WHERE
          /* <filter> */"
      `);
   });
});

describe("sql-select — expandFromClause", () => {
   test("with all clauses", () => {
      const result = expandFromClause(Account, {
         JOIN: sql`JOIN "order" ON "order"."account_id" = ${Account.$accountId}`,
         WHERE: sql`${Account.$status} = ${"active"}`,
         GROUP_BY: sql`${Account.$accountId}`,
         HAVING: sql`count(*) > ${1}`,
         ORDER_BY: sql`${Account.$createdAt} DESC`,
      });
      const { text } = result.getSql({ params: {} });
      expect(text).toContain("WHERE");
      expect(text).toContain("GROUP BY");
      expect(text).toContain("HAVING");
      expect(text).toContain("ORDER BY");
   });
});
