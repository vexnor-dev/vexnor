// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test } from "vitest";
import { Account, Order } from "@vexnor/core/testing";
import { sql, row, serializeQuery } from "@vexnor/core";
import { postgresSelect } from "#src/crud/postgres-select.js";
import { defaultQueryOptions } from "#src/default-query-options.js";

/**
 * Regression tests for `vexnor serialize` producing invalid SQL when serializing
 * CRUD `.select()` queries that have `includeOne` or `includeMany`.
 *
 * The bug manifests in two ways:
 * 1. Default $$ columns: the serialized SQL drops the main table columns entirely,
 *    producing `select , "query_1_result" as "firstOrder"` (leading comma, invalid).
 * 2. Custom SELECT clause: both runtime and serialized SQL wrap the column list in
 *    parentheses as a row constructor: `select ("a_1"."col", ...) as "query_N"`,
 *    which is invalid SQL rejected by PostgreSQL.
 *
 * The runtime execution (via getSql()) produces valid SQL for case 1 (default columns)
 * but is also broken for case 2 (custom SELECT with includes).
 */

// Pattern 1: `select` followed by whitespace then a comma (missing columns before charm alias).
// This catches the serialization bug where default $$ columns are dropped.
const MISSING_COLUMNS_PATTERN = /\bselect\s*\n\s*,/i;

// Pattern 2: immediately after `select`, an opening paren wrapping quoted column identifiers
// then `) as "query_N"` — this is the row-constructor wrapping bug.
// Matches: `select ( "a_1"."account_id", "a_1"."email") as "query_1"`
// Also matches with SQL comments interleaved: `select ( /* ... */ "a_1"."col" /* ... */ ) as "query_1"`
const ROW_CONSTRUCTOR_SELECT_PATTERN = /\bSELECT\s+\(\s*(?:\/\*.*?\*\/\s*)?("[a-z]_\d+"\.".+?")/s;

function extractSerializedSql(template: { type: string; value?: string }[]): string {
   return template
      .filter((n) => n.type === "text")
      .map((n) => n.value!)
      .join("");
}

describe("postgresSelect — serialize regression", () => {
   test("basic select serialization — no includes (should be valid)", async () => {
      const query = postgresSelect(Account, {});
      const { text } = query.source.getSql({ params: {}, options: defaultQueryOptions });

      // Runtime SQL should not have the bug patterns
      expect(text).not.toMatch(MISSING_COLUMNS_PATTERN);

      // Serialized SQL should also be valid
      const result = await serializeQuery(query.source, "basicSelect", "postgresql");
      const serializedSql = extractSerializedSql(result.template as { type: string; value?: string }[]);
      expect(serializedSql).not.toMatch(MISSING_COLUMNS_PATTERN);
   });

   test("select with includeOne — serialized SQL must include main table columns", async () => {
      const firstOrder = sql`
         select ${row(Order.$$)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
      `;
      const query = postgresSelect(Account, { includeOne: { firstOrder } });

      // Runtime SQL should be valid — all columns present
      const { text } = query.source.getSql({ params: {}, options: defaultQueryOptions });
      expect(text).not.toMatch(MISSING_COLUMNS_PATTERN);
      expect(text).toContain('"a_1"."account_id"');

      // Serialized SQL — THIS IS THE BUG: columns are missing from SELECT clause
      const result = await serializeQuery(query.source, "selectWithIncludeOne", "postgresql");
      const serializedSql = extractSerializedSql(result.template as { type: string; value?: string }[]);
      expect(serializedSql).not.toMatch(MISSING_COLUMNS_PATTERN);
   });

   test("select with includeMany — serialized SQL must include main table columns", async () => {
      const children = sql`
         select ${row(Account.as("children").$$)}
         from ${Account.as("children")}
         where ${Account.as("children").$parentId} = ${Account.$accountId}
      `;
      const query = postgresSelect(Account, { includeMany: { children } });

      // Runtime SQL should be valid — all columns present
      const { text } = query.source.getSql({ params: {}, options: defaultQueryOptions });
      expect(text).not.toMatch(MISSING_COLUMNS_PATTERN);
      expect(text).toContain('"a_1"."account_id"');

      // Serialized SQL — THIS IS THE BUG: columns are missing from SELECT clause
      const result = await serializeQuery(query.source, "selectWithIncludeMany", "postgresql");
      const serializedSql = extractSerializedSql(result.template as { type: string; value?: string }[]);
      expect(serializedSql).not.toMatch(MISSING_COLUMNS_PATTERN);
   });

   test("select with custom SELECT + includeOne — must not wrap in row constructor", async () => {
      const firstOrder = sql`
         select ${row(Order.$$)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
      `;
      const query = postgresSelect(Account, {
         SELECT: sql`${Account.$accountId}, ${Account.$email}`,
         includeOne: { firstOrder },
      });

      // Runtime SQL — also broken: wraps custom SELECT columns in parens as row constructor
      const { text } = query.source.getSql({ params: {}, options: defaultQueryOptions });
      expect(text).not.toMatch(ROW_CONSTRUCTOR_SELECT_PATTERN);

      // Serialized SQL — same bug: wraps columns in parens as row constructor
      const result = await serializeQuery(query.source, "customSelectWithIncludeOne", "postgresql");
      const serializedSql = extractSerializedSql(result.template as { type: string; value?: string }[]);
      expect(serializedSql).not.toMatch(ROW_CONSTRUCTOR_SELECT_PATTERN);
   });

   test("select with WHERE + includeOne — serialized SQL must include main table columns", async () => {
      const firstOrder = sql`
         select ${row(Order.$$)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
      `;
      const query = postgresSelect(Account, {
         WHERE: sql`${Account.$status} = 'active'`,
         includeOne: { firstOrder },
      });

      // Runtime SQL should be valid
      const { text } = query.source.getSql({ params: {}, options: defaultQueryOptions });
      expect(text).not.toMatch(MISSING_COLUMNS_PATTERN);

      // Serialized SQL — THIS IS THE BUG: columns are missing from SELECT clause
      const result = await serializeQuery(query.source, "whereWithIncludeOne", "postgresql");
      const serializedSql = extractSerializedSql(result.template as { type: string; value?: string }[]);
      expect(serializedSql).not.toMatch(MISSING_COLUMNS_PATTERN);
   });
});
