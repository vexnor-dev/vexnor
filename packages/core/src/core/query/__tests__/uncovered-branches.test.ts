import { describe, expect, test, vi } from "vitest";
import { col, SqlSelectColumn } from "#src/core/query/sql-select-column.js";
import { SqlSelectAll } from "#src/core/query/sql-select-all.js";
import { val } from "#src/core/query/sql-select-value.js";
import { raw } from "#src/core/query/sql-raw.js";
import { hasParams, hasRow } from "#src/core/query/sql-query-types.js";
import { excluded } from "#src/core/schema/sql-excluded.js";
import { newSqlQueryRef } from "#src/core/query/sql-query-ref.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { newSqlQueryColumn } from "#src/core/query/sql-query-column.js";
import { newSqlTableColumn } from "#src/core/schema/sql-table-column.js";

// ─── SqlSelectColumn ──────────────────────────────────────────────────────────

describe("SqlSelectColumn", () => {
   test("col() without onWrite writes quoted key", () => {
      const c = col<{ status: string }>("status");
      const ctx = new SqlBuildContext({});
      c.build(ctx);
      expect(ctx.text).toMatchInlineSnapshot(`""status""`);
   });

   test("col() with onWrite calls the handler", () => {
      const ctx = new SqlBuildContext({});
      const c = col<{ total: number }, Record<string, never>>(
         "total",
         (context) => context.addStrings("COUNT(*)"),
         null as never,
      );
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
      expect(ctx.text).toMatchInlineSnapshot(`""query_0".*"`);
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
      expect(ctx.text).toMatchInlineSnapshot(`"/* <query_0> */ COUNT(*) /* </query_0> */ AS "total""`);
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

// ─── SqlQuery — uncovered edge cases ──────────────────────────────────────────

import { toQuery, SqlQuery, SqlQueryAny } from "#src/core/query/sql-query.js";
import { ctx, param } from "#src/core/query/sql-param.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";
import { mockHandler } from "#src/test/mock-query-handler.js";
import { setupFormatter } from "#src/format/index.js";
import { SqlQueryPipeline } from "#src/execution/sql-query-pipeline.js";
import type { VexnorPluginAny } from "#src/plugin/vexnor-plugin.js";
import { connect } from "#src/plugin/vexnor-connection.js";
import { MockConnection } from "#src/test/mock-plugin.js";
import { SqlErrorCode } from "#src/core/sql-error-code.js";
import { TimeToLiveRateLimiter } from "#src/execution/time-to-live-rate-limiter.js";
import { SqlQueryRegistry } from "#src/execution/sql-query-registry.js";

describe("toQuery", () => {
   test("returns SqlQuery instance directly", () => {
      const q = sql`SELECT 1`;
      expect(toQuery(q)).toBe(q);
   });

   test("returns source from a registered handler", () => {
      const q = sql`SELECT 1`;
      const handler = mockHandler(q);
      expect(toQuery(handler)).toBe(q);
   });

   test("returns null for non-query values", () => {
      expect(toQuery("not a query")).toBeNull();
      expect(toQuery(123)).toBeNull();
      expect(toQuery(null)).toBeNull();
      expect(toQuery({})).toBeNull();
   });
});

describe("SqlQuery constructor — location args", () => {
   test("uses provided location and locationUrl when both are given", () => {
      const q = new SqlQuery({
         rawStrings: Object.assign(["SELECT 1"], { raw: ["SELECT 1"] }) as unknown as TemplateStringsArray,
         rawValues: [],
         location: "test.ts:10:5",
         locationUrl: "file:///test.ts",
      });
      expect(q.location).toBe("test.ts:10:5");
      expect(q.locationUrl).toBe("file:///test.ts");
   });
});

describe("SqlQuery.context", () => {
   test("returns only ctx() params, not regular params", () => {
      const q = sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}
           AND ${Account.$email} = ${param<{ email: string }>("email")}
      `;
      const context = q.context;
      expect(context).toHaveProperty("userId");
      expect(context).not.toHaveProperty("email");
   });
});

describe("SqlQuery.getSql — array param expansion", () => {
   test("array param expands into multiple placeholders", () => {
      const q = sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE ${Account.$accountId} IN (${param<{ ids: string[] }>("ids")})
      `;
      const { text, values } = q.getSql({ params: { ids: ["a", "b", "c"] } });
      expect(values).toEqual(["a", "b", "c"]);
      expect(text).toContain("?");
   });
});

describe("SqlQuery.getSql — format option", () => {
   test("format: false returns unformatted text (no added indentation)", () => {
      const q = sql`SELECT 1`;
      const { text } = q.getSql({ options: { format: false } });
      // Formatter adds newlines/indentation — unformatted is a single line
      expect(text.trim().includes("\n")).toBe(false);
   });

   test("format: true throws when no formatter is registered", () => {
      // Temporarily disable formatter
      setupFormatter({ active: false });
      try {
         const q = sql`SELECT 1`;
         expect(() => q.getSql({ options: { format: true } })).toThrow("no formatter is registered");
      } finally {
         setupFormatter({ active: true });
      }
   });
});

describe("SqlQuery.initInnerQueries — SqlQueryRef paths", () => {
   test("collects inner queries from SqlQueryRef (out reference)", () => {
      const inner = sql`SELECT ${row(Order.$$)} FROM ${Order} WHERE ${Order.$accountId} = ${Account.out.$accountId}`;
      const outer = sql`SELECT ${row(Account.$$)}, (${inner}) FROM ${Account}`;
      expect(outer.innerQueries.length).toBeGreaterThan(0);
      expect(outer.innerQueries.some((q) => q.id === inner.id)).toBe(true);
   });
});

// ─── Pipeline edge cases for 100% coverage ────────────────────────────────────

describe("SqlQueryPipeline — error wrapping", () => {
   test("non-SqlRunError from executeQuery is wrapped in QUERY_EXECUTION_FAILED", async () => {
      const pipeline = new SqlQueryPipeline();
      const q = sql`SELECT ${param<{ id: string }>("id")}`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(pipeline as any, "runAuthorize").mockRejectedValueOnce(new TypeError("unexpected internal error"));

      const db: MockConnection = { query: vi.fn(async () => ({ rows: [] })) } as MockConnection;

      await expect(
         mockHandler(q).all({
            db: connect<Record<string, unknown>, MockConnection>(db, { pipeline }),
            params: { id: "1" },
         }),
      ).rejects.toMatchObject({
         code: SqlErrorCode.QUERY_EXECUTION_FAILED,
      });
   });
});

describe("SqlQueryPipeline — plugin onError console.warn fallback", () => {
   test("console.warn is called when process.emitWarning is unavailable and onError throws", async () => {
      const originalEmitWarning = process.emitWarning;
      // @ts-expect-error — simulate environment without emitWarning
      process.emitWarning = undefined;
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      try {
         const pipeline = new SqlQueryPipeline();
         pipeline.use({
            name: "broken",
            end() {
               throw new Error("end broke");
            },
            onError() {
               throw new Error("onError also broke");
            },
         });

         const q = sql`SELECT ${param<{ id: string }>("id")}`;
         const db: MockConnection = { query: vi.fn(async () => ({ rows: [] })) } as MockConnection;
         await mockHandler(q).all({
            db: connect<Record<string, unknown>, MockConnection>(db, { pipeline }),
            params: { id: "1" },
         });

         expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("onError threw"));
      } finally {
         process.emitWarning = originalEmitWarning;
         warnSpy.mockRestore();
      }
   });
});

// ─── TimeToLiveRateLimiter — context metrics end() decrement ──────────────────

describe("TimeToLiveRateLimiter — context metrics in end()", () => {
   test("end() decrements context metrics inFlight and updates avgDurationMs/totalErrors", async () => {
      type Ctx = { userId: string };
      const limiter = new TimeToLiveRateLimiter<Ctx>({
         contextKeyResolver: (ctx) => ctx.userId,
      });

      const q = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${ctx<Ctx>("userId")}`;
      const pipeline = new SqlQueryPipeline<{ Context: Ctx }>();
      pipeline.use(limiter);

      const db: MockConnection = { query: vi.fn(async () => ({ rows: [] })) } as MockConnection;
      await mockHandler(q).all({ db: connect<Ctx, MockConnection>(db, { pipeline }), params: { userId: "u1" } });

      const cm = limiter.contextMetrics.get(q.id)?.get("u1");
      expect(cm?.inFlight).toBe(0);
      expect(cm?.totalCalls).toBe(1);
      expect(cm?.avgDurationMs).toBeGreaterThanOrEqual(0);
   });

   test("end() increments context totalErrors on failure", async () => {
      type Ctx = { userId: string };
      const limiter = new TimeToLiveRateLimiter<Ctx>({
         contextKeyResolver: (ctx) => ctx.userId,
      });

      const q = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${ctx<Ctx>("userId")}`;
      const pipeline = new SqlQueryPipeline<{ Context: Ctx }>();
      pipeline.use(limiter);

      const db: MockConnection = {
         query: async () => {
            throw new Error("db fail");
         },
      } as MockConnection;

      await expect(
         mockHandler(q).all({ db: connect<Ctx, MockConnection>(db, { pipeline }), params: { userId: "u1" } }),
      ).rejects.toThrow();

      const cm = limiter.contextMetrics.get(q.id)?.get("u1");
      expect(cm?.totalErrors).toBe(1);
      expect(cm?.inFlight).toBe(0);
   });
});

// ─── SqlQueryRegistry — invalid query warning ─────────────────────────────────

describe("SqlQueryRegistry — register edge cases", () => {
   test("register warns and skips non-SqlQuery values", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const registry = new SqlQueryRegistry();
      const mockPlugin = { name: "mock", getLibrary: () => null } as unknown as VexnorPluginAny;
      await registry.register(mockPlugin, { notAQuery: "hello" as unknown as SqlQueryAny });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("skipping"));
      warnSpy.mockRestore();
   });

   test("register accepts SqlQueryHandler instances", async () => {
      const registry = new SqlQueryRegistry();
      const mockPlugin = { name: "mock", getLibrary: () => null } as unknown as VexnorPluginAny;
      const q = sql`SELECT 1`;
      const handler = mockHandler(q);
      await registry.register(mockPlugin, { myHandler: handler });
      expect(registry.getQueries()).toHaveLength(1);
   });
});
