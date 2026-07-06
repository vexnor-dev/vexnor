// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test } from "vitest";
import "@vexnor/mssql";
import { Account, Order } from "@vexnor/core/testing";
import { sql, row, serializeQuery } from "@vexnor/core";
import { mssqlSelect } from "#src/crud/mssql-select.js";
import { defaultQueryOptions } from "#src/default-query-options.js";

/**
 * Regression tests for `vexnor serialize` producing invalid SQL when serializing
 * CRUD `.select()` queries that have `includeOne` or `includeMany`.
 *
 * The bug manifests in two ways:
 * 1. Default $$ columns: the serialized SQL drops the main table columns entirely,
 *    producing `select , "query_1_result"."query_1" as "firstOrder"` (leading comma, invalid).
 * 2. Custom SELECT clause: both runtime and serialized SQL wrap the column list in
 *    parentheses as a row constructor: `select ("a_1"."col", ...) as "query_N"`,
 *    which is invalid SQL rejected by MSSQL.
 *
 * The runtime execution (via getSql()) produces valid SQL for case 1 (default columns)
 * but is also broken for case 2 (custom SELECT with includes).
 */

// Pattern 1: `select` followed by whitespace then a comma (missing columns before charm alias).
// This catches the serialization bug where default $$ columns are dropped.
const MISSING_COLUMNS_PATTERN = /\bselect\s*\n\s*,/i;

// Pattern 2: immediately after `select`, an opening paren wrapping quoted column identifiers
// then `) as "query_N"` — this is the row-constructor wrapping bug.
const ROW_CONSTRUCTOR_SELECT_PATTERN = /\bSELECT\s+\(\s*(?:\/\*.*?\*\/\s*)?("[a-z]_\d+"\.".+?")/s;

function extractSerializedSql(template: { type: string; value?: string }[]): string {
   return template
      .filter((n) => n.type === "text")
      .map((n) => n.value!)
      .join("");
}

describe("mssqlSelect — serialize regression", () => {
   test("basic select serialization — no includes (should be valid)", async () => {
      const query = mssqlSelect(Account, {});
      const { text } = query.source.getSql({ options: defaultQueryOptions });

      // Runtime SQL should not have the bug patterns
      expect(text).not.toMatch(MISSING_COLUMNS_PATTERN);

      // Serialized SQL should also be valid
      const result = await serializeQuery(query.source, "basicSelect", "transactsql");
      const serializedSql = extractSerializedSql(result.template as { type: string; value?: string }[]);
      expect(serializedSql).not.toMatch(MISSING_COLUMNS_PATTERN);
   });

   test("select with includeOne — serialized SQL must include main table columns", async () => {
      const firstOrder = sql`
         select ${row(Order.$$)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
      `;
      const query = mssqlSelect(Account, { includeOne: { firstOrder } });

      // Runtime SQL should be valid — all columns present
      const { text } = query.source.getSql({ options: defaultQueryOptions });
      expect(text).not.toMatch(MISSING_COLUMNS_PATTERN);
      expect(text).toContain('"a_1"."account_id"');

      // Serialized SQL — THIS IS THE BUG: columns are missing from SELECT clause
      const result = await serializeQuery(query.source, "selectWithIncludeOne", "transactsql");
      const serializedSql = extractSerializedSql(result.template as { type: string; value?: string }[]);
      expect(serializedSql).not.toMatch(MISSING_COLUMNS_PATTERN);
   });

   test("select with includeMany — serialized SQL must include main table columns", async () => {
      const orders = sql`
         select ${row(Order.$$)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
      `;
      const query = mssqlSelect(Account, { includeMany: { orders } });

      // Runtime SQL should be valid — all columns present
      const { text } = query.source.getSql({ options: defaultQueryOptions });
      expect(text).not.toMatch(MISSING_COLUMNS_PATTERN);
      expect(text).toContain('"a_1"."account_id"');

      // Serialized SQL — THIS IS THE BUG: columns are missing from SELECT clause
      const result = await serializeQuery(query.source, "selectWithIncludeMany", "transactsql");
      const serializedSql = extractSerializedSql(result.template as { type: string; value?: string }[]);
      expect(serializedSql).not.toMatch(MISSING_COLUMNS_PATTERN);
   });

   test("select with custom SELECT + includeOne — must not wrap in row constructor", async () => {
      const firstOrder = sql`
         select ${row(Order.$$)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
      `;
      const query = mssqlSelect(Account, {
         SELECT: sql`${Account.$accountId}, ${Account.$email}`,
         includeOne: { firstOrder },
      });

      // Runtime SQL — also broken: wraps custom SELECT columns in parens as row constructor
      const { text } = query.source.getSql({ options: defaultQueryOptions });
      expect(text).not.toMatch(ROW_CONSTRUCTOR_SELECT_PATTERN);

      // Serialized SQL — same bug: wraps columns in parens as row constructor
      const result = await serializeQuery(query.source, "customSelectWithIncludeOne", "transactsql");
      const serializedSql = extractSerializedSql(result.template as { type: string; value?: string }[]);
      expect(serializedSql).not.toMatch(ROW_CONSTRUCTOR_SELECT_PATTERN);
   });

   test("select with WHERE + includeOne — serialized SQL must include main table columns", async () => {
      const firstOrder = sql`
         select ${row(Order.$$)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
      `;
      const query = mssqlSelect(Account, {
         WHERE: sql`${Account.$status} = 'active'`,
         includeOne: { firstOrder },
      });

      // Runtime SQL should be valid
      const { text } = query.source.getSql({ options: defaultQueryOptions });
      expect(text).not.toMatch(MISSING_COLUMNS_PATTERN);

      // Serialized SQL — THIS IS THE BUG: columns are missing from SELECT clause
      const result = await serializeQuery(query.source, "whereWithIncludeOne", "transactsql");
      const serializedSql = extractSerializedSql(result.template as { type: string; value?: string }[]);
      expect(serializedSql).not.toMatch(MISSING_COLUMNS_PATTERN);
   });
});
