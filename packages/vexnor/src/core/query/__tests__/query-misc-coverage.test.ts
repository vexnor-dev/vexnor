import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { param } from "#/core/query/sql-param.js";
import { val } from "#/core/query/sql-select-value.js";
import { raw } from "#/core/query/sql-raw.js";
import { col } from "#/core/query/sql-select-column.js";
import { contextValue, isContextValue } from "#/core/query/context-value.js";
import { isSqlLanguage } from "#/core/query/lib/is-sql-language.js";
import { SqlDefault, DEFAULT } from "#/core/query/sql-default.js";
import { input } from "#/core/query/sql-input.js";
import { isQuery, toQuery } from "#/core/query/sql-query.js";
import { hasParams, hasRow, isRemoteClient } from "#/core/query/sql-query-types.js";

describe("context-value", () => {
   test("contextValue is defined", () => {
      expect(contextValue).toBeDefined();
   });

   test("isContextValue returns true for contextValue", () => {
      expect(isContextValue(contextValue)).toBe(true);
   });

   test("isContextValue returns false for other values", () => {
      expect(isContextValue(null)).toBe(false);
      expect(isContextValue("string")).toBe(false);
      expect(isContextValue(42)).toBe(false);
   });
});

describe("isSqlLanguage", () => {
   test("returns true for known languages", () => {
      expect(isSqlLanguage("sql")).toBe(true);
      expect(isSqlLanguage("postgresql")).toBe(true);
   });

   test("returns false for unknown strings", () => {
      expect(isSqlLanguage("not-a-language")).toBe(false);
   });
});

describe("SqlDefault", () => {
   test("DEFAULT writes 'DEFAULT' to context", () => {
      const context = new SqlBuildContext({ dialect: "postgresql" });
      DEFAULT.build(context);
      expect(context.tokens[0]).toMatchInlineSnapshot(`
        {
          "type": "text",
          "value": "DEFAULT",
        }
      `);
   });

   test("DEFAULT is instance of SqlDefault", () => {
      expect(DEFAULT).toBeInstanceOf(SqlDefault);
   });
});

describe("input()", () => {
   test("creates proxy that generates SqlParams on access", () => {
      const p = input<{ firstName: string; email: string }>();
      expect(p.$firstName).toBeDefined();
      expect(p.$firstName.name).toBe("firstName");
      expect(p.$email).toBeDefined();
      expect(p.$email.name).toBe("email");
   });

   test("proxy has() returns true for string props", () => {
      const p = input<{ name: string }>();
      expect("$name" in p).toBe(true);
      expect("anything" in p).toBe(true);
   });

   test("proxy get returns undefined for symbol", () => {
      const p = input<{ name: string }>();
      expect((p as Record<symbol, unknown>)[Symbol("test")]).toBeUndefined();
   });

   test("caches SqlParam instances", () => {
      const p = input<{ name: string }>();
      const first = p.$name;
      const second = p.$name;
      expect(first).toBe(second);
   });
});

describe("sql-query-types helpers", () => {
   test("hasParams returns true for objects with params", () => {
      expect(hasParams({ params: { id: "test" } })).toBe(true);
   });

   test("hasParams returns false for null/non-object", () => {
      expect(hasParams(null)).toBe(false);
      expect(hasParams(undefined)).toBe(false);
      expect(hasParams("string")).toBe(false);
   });

   test("hasRow returns false for non-Sql", () => {
      expect(hasRow(null)).toBe(false);
      expect(hasRow({})).toBe(false);
   });

   test("hasRow returns true for Sql with row", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      expect(hasRow(query)).toBe(true);
   });

   test("isRemoteClient returns true for objects with remoteExecute", () => {
      expect(isRemoteClient({ remoteExecute: () => {} })).toBe(true);
   });

   test("isRemoteClient returns false for other values", () => {
      expect(isRemoteClient(null)).toBe(false);
      expect(isRemoteClient({})).toBe(false);
      expect(isRemoteClient("string")).toBe(false);
   });
});

describe("isQuery / toQuery", () => {
   test("isQuery returns true for SqlQuery", () => {
      const q = sql`SELECT 1`;
      expect(isQuery(q)).toBe(true);
   });

   test("isQuery returns false for non-query", () => {
      expect(isQuery({})).toBe(false);
      expect(isQuery(null)).toBe(false);
   });

   test("toQuery returns the SqlQuery for a query", () => {
      const q = sql`SELECT 1`;
      expect(toQuery(q)).toBe(q);
   });

   test("toQuery returns null for non-query", () => {
      expect(toQuery({})).toBeNull();
      expect(toQuery(null)).toBeNull();
   });
});

describe("SqlRaw", () => {
   test("raw.BLANK emits nothing", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      raw.BLANK.build(context);
      expect(context.tokens).toMatchInlineSnapshot(`[]`);
   });

   test("raw.SPACE emits a space", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      raw.SPACE.build(context);
      expect(context.tokens[0]).toMatchInlineSnapshot(`
        {
          "type": "text",
          "value": " ",
        }
      `);
   });

   test("raw() emits unquoted text", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      raw("SOME TEXT").build(context);
      expect(context.tokens[0]).toMatchInlineSnapshot(`
        {
          "type": "text",
          "value": "SOME TEXT",
        }
      `);
   });
});

describe("val() with SqlQuery argument", () => {
   test("val wrapping existing query", () => {
      const subquery = sql`SELECT count(*) FROM ${Account}`;
      const column = val(subquery).as<{ count: number }>("count");
      expect(column.key).toBe("count");
      expect(column.innerQuery).toBe(subquery);
   });
});

describe("col() with onWrite", () => {
   test("col with custom onWrite emits custom SQL", () => {
      const column = col<{ total: number }>(
         "total",
         (ctx) => ctx.addStrings("COUNT(*)"),
         null as never,
      );
      const context = new SqlBuildContext({ dialect: "sql" });
      column.build(context);
      expect(context.tokens[0]).toMatchInlineSnapshot(`
        {
          "type": "text",
          "value": "COUNT(*)",
        }
      `);
   });
});
