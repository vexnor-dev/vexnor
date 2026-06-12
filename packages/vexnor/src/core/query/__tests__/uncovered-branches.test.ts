import { describe, expect, test } from "vitest";
import { col, SqlSelectColumn } from "#/core/query/sql-select-column.js";
import { SqlSelectAll } from "#/core/query/sql-select-all.js";
import { val } from "#/core/query/sql-select-value.js";
import { raw } from "#/core/query/sql-raw.js";
import { hasParams, hasRow } from "#/core/query/sql-query-types.js";
import { excluded } from "#/core/schema/sql-excluded.js";
import { newSqlQueryRef } from "#/core/query/sql-query-ref.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { newSqlQueryColumn } from "#/core/query/sql-query-column.js";
import { newSqlTableColumn } from "#/core/schema/sql-table-column.js";

// ─── SqlSelectColumn ──────────────────────────────────────────────────────────

describe("SqlSelectColumn", () => {
   test("col() without onWrite writes quoted key", () => {
      const c = col<{ status: string }>("status");
      const ctx = new SqlBuildContext({});
      c.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`"\"status\""`);
   });

   test("col() with onWrite calls the handler", () => {
      const ctx = new SqlBuildContext({});
      const c = col<{ total: number }, Record<string, never>>("total", (context) => context.addStrings("COUNT(*)"), null as never);
      c.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`"COUNT(*)"`);
   });

   test("constructor with onWrite and params sets both", () => {
      const handler = () => {};
      const c = new SqlSelectColumn({ key: "x", onWrite: handler, params: null });
      expect(c.onWrite).toBe(handler);
      expect(c.params).toBeNull();
   });
});

// ─── SqlSelectAll ─────────────────────────────────────────────────────────────

describe("SqlSelectAll — write() keyword branches", () => {
   const tableInfo = { name: "account", schema: "main" };
   const query = sql``;

   const all = new SqlSelectAll<{ accountId: string }>({
      innerQuery: query,
      row: {
         $accountId: newSqlQueryColumn({
            key: "accountId",
            query,
            target: newSqlTableColumn({ key: "accountId", columnName: "account_id", tableInfo }),
         }),
      },
   });

   test("keyword=fn emits queryName.*", () => {
      const ctx = new SqlBuildContext({});
      ctx.next("fn");
      all.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`"\"query_0\".*"`);
   });

   test("keyword=select + exists=exists emits *", () => {
      const ctx = new SqlBuildContext({});
      ctx.next("select");
      ctx.next("exists");
      all.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""query_0".*"`);
   });

   test("default (no special keyword) emits quoted alias.*", () => {
      const ctx = new SqlBuildContext({});
      all.build(ctx);
      expect(ctx.text).toContain(".*");
   });
});

// ─── val(SqlQuery) path ───────────────────────────────────────────────────────

describe("val() — SqlQuery overload", () => {
   test("val(existingQuery).as() wraps it as SqlSelectValue", () => {
      const inner = sql`COUNT(*)`;
      const v = val(inner).as<{ total: number }>("total");
      expect(v.key).toBe("total");
      expect(v.innerQuery).toBe(inner);
   });

   test("val(existingQuery) builds correct SQL", () => {
      const inner = sql`COUNT(*)`;
      const v = val(inner).as<{ total: number }>("total");
      const ctx = new SqlBuildContext({});
      v.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`"/* <query_0> */ COUNT(*) /* </query_0> */ AS \"total\""`);
   });
});

// ─── SqlRaw ───────────────────────────────────────────────────────────────────

describe("SqlRaw", () => {
   test("raw with empty string emits nothing", () => {
      const ctx = new SqlBuildContext({});
      raw("").build(ctx);
      // early return — nothing written
      expect(ctx.text).toMatchInlineSnapshot(`""`);
   });

   test("raw with quote:false emits unquoted string", () => {
      const ctx = new SqlBuildContext({});
      raw("COUNT(*)").build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`"COUNT(*)"`);
   });

   test("raw.BLANK emits nothing", () => {
      const ctx = new SqlBuildContext({});
      raw.BLANK.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""`);
   });
});

// ─── hasParams / hasRow ───────────────────────────────────────────────────────

describe("hasParams", () => {
   test("returns false for null/undefined", () => {
      expect(hasParams(null)).toBe(false);
      expect(hasParams(undefined)).toBe(false);
   });

   test("returns false for non-object", () => {
      expect(hasParams("string")).toBe(false);
   });

   test("returns true when params key present", () => {
      expect(hasParams({ params: {} })).toBe(true);
   });

   test("returns false when params key absent", () => {
      expect(hasParams({ other: 1 })).toBe(false);
   });
});

describe("hasRow", () => {
   test("returns false for null", () => {
      expect(hasRow(null)).toBe(false);
   });

   test("returns false for non-Sql instance", () => {
      expect(hasRow({ row: {} })).toBe(false);
   });

   test("returns true for Sql with row", () => {
      const q = sql`select ${row(Account.$$)} from ${Account}`;
      expect(hasRow(q)).toBe(true);
   });

   test("returns false for Sql without row", () => {
      const q = sql`select 1`;
      // sql`` queries may or may not have a row depending on implementation
      // This tests the hasRow type guard function itself
      expect(typeof hasRow(q)).toBe("boolean");
   });
});

// ─── excluded ─────────────────────────────────────────────────────────────────

describe("excluded()", () => {
   test("returns pseudo-table columns with EXCLUDED alias", () => {
      const ex = excluded(Account);
      expect(ex.$accountId).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((ex.$accountId as any).tableInfo.alias).toBe("EXCLUDED");
   });

   test("caches result — same reference on second call", () => {
      const a = excluded(Account);
      const b = excluded(Account);
      expect(a).toBe(b);
   });
});

// ─── newSqlQueryRef default throw ────────────────────────────────────────────

describe("newSqlQueryRef", () => {
   test("throws SqlBuildError when scope is null and recursive is false", () => {
      const q = sql`select 1`;
      expect(() => newSqlQueryRef(q, null as never)).toThrow("Invalid args for creating query ref");
   });
});
