import { describe, expect, test, vi } from "vitest";
import { TimeToLiveRateLimiter } from "#/execution/time-to-live-rate-limiter.js";
import { SqlRunError } from "#/core/sql-run-error.js";
import { SqlErrorCode } from "#/core/sql-error-code.js";
import type { SqlPipelineExecutionArgs, SqlPipelineEndArgs } from "#/execution/sql-query-pipeline-plugin.js";

// ── minimal stubs ─────────────────────────────────────────────────────────────

const stubPlugin = {} as SqlPipelineExecutionArgs["plugin"];
const stubQueryA = { id: "query-a" } as SqlPipelineExecutionArgs["query"];
const stubQueryB = { id: "query-b" } as SqlPipelineExecutionArgs["query"];
const stubQuery = stubQueryA;

type Ctx = { userId: string };

function execArgs(overrides: Partial<SqlPipelineExecutionArgs> = {}): SqlPipelineExecutionArgs {
   return {
      plugin: stubPlugin,
      name: "findAccounts",
      query: stubQuery,
      mode: "read",
      remote: {
         plugin: stubPlugin.name,
         hash: "hash-a",
         location: null,
         params: {},
         mode: "read",
         name: "testQuery",
      },
      params: {},
      context: {},
      ...overrides,
   };
}

function ctxArgs(
   userId: string,
   overrides: Partial<SqlPipelineExecutionArgs<Ctx>> = {},
): SqlPipelineExecutionArgs<Ctx> {
   return {
      plugin: stubPlugin,
      query: stubQuery,
      name: "findAccounts",
      mode: "read",
      remote: {
         plugin: stubPlugin.name,
         hash: "hash-a",
         location: null,
         params: {},
         mode: "read",
         name: "testQuery",
      },
      params: {},
      context: { userId },
      ...overrides,
   };
}

function endArgs(overrides: Partial<SqlPipelineEndArgs> = {}): SqlPipelineEndArgs {
   return { ...execArgs(), durationMs: 10, error: null, ...overrides };
}

function ctxEndArgs(userId: string, overrides: Partial<SqlPipelineEndArgs<Ctx>> = {}): SqlPipelineEndArgs<Ctx> {
   return { ...ctxArgs(userId), durationMs: 10, error: null, ...overrides };
}

// ── metrics tracking ──────────────────────────────────────────────────────────

describe("TimeToLiveRateLimiter — metrics tracking", () => {
   test("init() increments inFlight and totalCalls", async () => {
      const limiter = new TimeToLiveRateLimiter();
      limiter.init(execArgs());

      expect(limiter.metrics.get("query-a")).toMatchInlineSnapshot(`
        {
          "avgDurationMs": 0,
          "inFlight": 1,
          "totalCalls": 1,
          "totalErrors": 0,
        }
      `);
   });

   test("end() decrements inFlight and updates avgDurationMs", async () => {
      const limiter = new TimeToLiveRateLimiter();
      limiter.init(execArgs());
      await limiter.check(execArgs());
      await limiter.end(endArgs({ durationMs: 20 }));

      expect(limiter.metrics.get("query-a")).toMatchInlineSnapshot(`
        {
          "avgDurationMs": 20,
          "inFlight": 0,
          "totalCalls": 1,
          "totalErrors": 0,
        }
      `);
   });

   test("avgDurationMs is a rolling average across multiple completions", async () => {
      const limiter = new TimeToLiveRateLimiter();
      limiter.init(execArgs());
      await limiter.check(execArgs());
      limiter.init(execArgs());
      await limiter.check(execArgs());
      await limiter.end(endArgs({ durationMs: 10 }));
      await limiter.end(endArgs({ durationMs: 30 }));

      const m = limiter.metrics.get("query-a")!;
      expect(m.avgDurationMs).toBe(20);
      expect(m.totalCalls).toBe(2);
      expect(m.inFlight).toBe(0);
   });

   test("end() increments totalErrors on failure", async () => {
      const limiter = new TimeToLiveRateLimiter();
      limiter.init(execArgs());
      await limiter.check(execArgs());
      await limiter.end(endArgs({ error: new Error("oops") }));

      expect(limiter.metrics.get("query-a")!.totalErrors).toBe(1);
   });

   test("end() is a no-op when hash is unknown", () => {
      const limiter = new TimeToLiveRateLimiter();
      expect(() =>
         limiter.end(
            endArgs({
               query: { id: "unknown" } as SqlPipelineExecutionArgs["query"],
            }),
         ),
      ).not.toThrow();
   });

   test("tracks separate metrics per query id", async () => {
      const limiter = new TimeToLiveRateLimiter();
      limiter.init(execArgs());
      await limiter.check(execArgs());
      limiter.init(execArgs({ query: stubQueryB }));
      await limiter.check(execArgs({ query: stubQueryB }));
      limiter.end(endArgs({ durationMs: 5 }));

      expect(limiter.metrics.get("query-a")).toMatchInlineSnapshot(`
        {
          "avgDurationMs": 5,
          "inFlight": 0,
          "totalCalls": 1,
          "totalErrors": 0,
        }
      `);
      expect(limiter.metrics.get("query-b")).toMatchInlineSnapshot(`
        {
          "avgDurationMs": 0,
          "inFlight": 1,
          "totalCalls": 1,
          "totalErrors": 0,
        }
      `);
   });
});

// ── context metrics ───────────────────────────────────────────────────────────

describe("TimeToLiveRateLimiter — context metrics", () => {
   test("check and end() track per-context metrics when contextKeyResolver is set", async () => {
      const limiter = new TimeToLiveRateLimiter<Ctx>({ contextKeyResolver: (ctx) => ctx.userId });

      limiter.init(ctxArgs("u1"));
      await limiter.check(ctxArgs("u1"));
      await limiter.end(ctxEndArgs("u1", { durationMs: 15 }));

      const cm = limiter.contextMetrics.get("query-a")?.get("u1");
      expect(cm?.lastActivityAt).toEqual(expect.any(Number));
      expect({ ...cm, lastActivityAt: 0 }).toMatchInlineSnapshot(`
        {
          "avgDurationMs": 15,
          "contextKey": "u1",
          "inFlight": 0,
          "lastActivityAt": 0,
          "totalCalls": 1,
          "totalErrors": 0,
        }
      `);
   });

   test("context metrics are not tracked when no contextKeyResolver is set", async () => {
      const limiter = new TimeToLiveRateLimiter();
      limiter.init(execArgs());
      await limiter.check(execArgs());

      expect(limiter.contextMetrics.size).toBe(0);
   });

   test("separate context keys are tracked independently", async () => {
      const limiter = new TimeToLiveRateLimiter<Ctx>({ contextKeyResolver: (ctx) => ctx.userId });

      limiter.init(ctxArgs("u1"));
      await limiter.check(ctxArgs("u1"));
      limiter.init(ctxArgs("u2"));
      await limiter.check(ctxArgs("u2"));
      await limiter.end(ctxEndArgs("u1", { durationMs: 10 }));
      await limiter.end(ctxEndArgs("u2", { durationMs: 20 }));

      expect(limiter.contextMetrics.get("query-a")?.get("u1")?.avgDurationMs).toBe(10);
      expect(limiter.contextMetrics.get("query-a")?.get("u2")?.avgDurationMs).toBe(20);
   });
});

// ── maxConcurrent ─────────────────────────────────────────────────────────────

describe("TimeToLiveRateLimiter — maxConcurrent", () => {
   test("rejects when inFlight reaches maxConcurrent", async () => {
      const limiter = new TimeToLiveRateLimiter({ maxConcurrent: 1 });
      limiter.init(execArgs());
      await limiter.check(execArgs());

      limiter.init(execArgs());
      await expect(limiter.check(execArgs())).rejects.toMatchInlineSnapshot(
         `[SqlRunError: Query "findAccounts" rejected — concurrency limit of 1 reached (2 in flight)]`,
      );
   });

   test("allows execution after inFlight drops back below limit", async () => {
      const limiter = new TimeToLiveRateLimiter({ maxConcurrent: 1 });
      limiter.init(execArgs());
      await limiter.check(execArgs());
      await limiter.end(endArgs());

      limiter.init(execArgs());
      await expect(limiter.check(execArgs())).resolves.toBeUndefined();
   });

   test("does not reject below the limit", async () => {
      const limiter = new TimeToLiveRateLimiter({ maxConcurrent: 2 });
      limiter.init(execArgs());
      await limiter.check(execArgs());
      limiter.init(execArgs());
      await expect(limiter.check(execArgs())).resolves.toBeUndefined();
   });
});

// ── maxConcurrentPerContext ───────────────────────────────────────────────────

describe("TimeToLiveRateLimiter — maxConcurrentPerContext", () => {
   test("rejects when per-context inFlight reaches maxConcurrentPerContext", async () => {
      const limiter = new TimeToLiveRateLimiter<Ctx>({
         contextKeyResolver: (ctx) => ctx.userId,
         maxConcurrentPerContext: 1,
      });
      limiter.init(ctxArgs("u1"));
      await limiter.check(ctxArgs("u1"));

      limiter.init(ctxArgs("u1"));
      await expect(limiter.check(ctxArgs("u1"))).rejects.toMatchInlineSnapshot(
         `[SqlRunError: Query "findAccounts" rejected — per-context concurrency limit of 1 reached for key "u1" (2 in flight)]`,
      );
   });

   test("does not reject a different context key", async () => {
      const limiter = new TimeToLiveRateLimiter<Ctx>({
         contextKeyResolver: (ctx) => ctx.userId,
         maxConcurrentPerContext: 1,
      });
      limiter.init(ctxArgs("u1"));
      await limiter.check(ctxArgs("u1"));

      limiter.init(ctxArgs("u2"));
      await expect(limiter.check(ctxArgs("u2"))).resolves.toBeUndefined();
   });

   test("does not apply when no contextKeyResolver is configured", async () => {
      const limiter = new TimeToLiveRateLimiter({ maxConcurrentPerContext: 1 });
      limiter.init(execArgs());
      await limiter.check(execArgs());
      limiter.init(execArgs());
      await expect(limiter.check(execArgs())).resolves.toBeUndefined();
   });
});

// ── custom limit hook ─────────────────────────────────────────────────────────

describe("TimeToLiveRateLimiter — limit hook", () => {
   test("limit hook is called with metrics snapshots", async () => {
      const limit = vi.fn();
      const limiter = new TimeToLiveRateLimiter<Ctx>({ contextKeyResolver: (ctx) => ctx.userId, limit });

      limiter.init(ctxArgs("u1"));
      await limiter.check(ctxArgs("u1"));

      expect(limit).toHaveBeenCalledOnce();
      expect(limit).toHaveBeenCalledWith(
         expect.objectContaining({
            queryMetrics: { inFlight: 1, totalCalls: 1, totalErrors: 0, avgDurationMs: 0 },
            contextMetrics: expect.objectContaining({ contextKey: "u1", inFlight: 1, totalCalls: 1 }),
         }),
      );
   });

   test("limit hook throwing wraps error in SqlRunError with QUERY_RATE_LIMITED", async () => {
      const limiter = new TimeToLiveRateLimiter({
         limit: () => {
            throw new Error("too many");
         },
      });

      limiter.init(execArgs());
      await expect(limiter.check(execArgs())).rejects.toMatchInlineSnapshot(
         `[SqlRunError: Rate limit exceeded for query "findAccounts". (Error: too many)]`,
      );
   });

   test("limit hook throwing SqlRunError propagates as-is", async () => {
      const limiter = new TimeToLiveRateLimiter({
         limit: ({ query, name }) => {
            throw new SqlRunError("custom", query, { queryName: name, code: SqlErrorCode.QUERY_RATE_LIMITED });
         },
      });

      limiter.init(execArgs());
      await expect(limiter.check(execArgs())).rejects.toMatchInlineSnapshot(`[SqlRunError: custom]`);
   });

   test("limit hook runs after maxConcurrent check — not called on second rejected check", async () => {
      const limit = vi.fn();
      const limiter = new TimeToLiveRateLimiter({ maxConcurrent: 1, limit });
      limiter.init(execArgs());
      await limiter.check(execArgs());

      limiter.init(execArgs());
      await expect(limiter.check(execArgs())).rejects.toThrow("concurrency limit");
      expect(limit).toHaveBeenCalledOnce();
   });
});

// ── TTL sweep ─────────────────────────────────────────────────────────────────

describe("TimeToLiveRateLimiter — TTL sweep", () => {
   test("idle context entries are evicted after TTL on next check()", async () => {
      let currentTime = Date.now();
      const limiter = new TimeToLiveRateLimiter<Ctx>({
         contextKeyResolver: (ctx) => ctx.userId,
         contextMetricsTtlMs: 1,
         now: () => currentTime,
      });

      limiter.init(ctxArgs("u1"));
      await limiter.check(ctxArgs("u1"));
      await limiter.end(ctxEndArgs("u1"));

      currentTime += 100; // advance time past TTL

      limiter.init(ctxArgs("u2"));
      await limiter.check(ctxArgs("u2"));

      expect(limiter.contextMetrics.get("query-a")?.has("u1")).toBe(false);
      expect(limiter.contextMetrics.get("query-a")?.has("u2")).toBe(true);
   });

   test("in-flight context entries are not evicted by sweep", async () => {
      let currentTime = Date.now();
      const limiter = new TimeToLiveRateLimiter<Ctx>({
         contextKeyResolver: (ctx) => ctx.userId,
         contextMetricsTtlMs: 1,
         now: () => currentTime,
      });

      limiter.init(ctxArgs("u1"));
      await limiter.check(ctxArgs("u1")); // inFlight = 1, not yet recorded

      currentTime += 100; // advance time past TTL

      limiter.init(ctxArgs("u2"));
      await limiter.check(ctxArgs("u2"));

      expect(limiter.contextMetrics.get("query-a")?.has("u1")).toBe(true);
   });
});

// ── clearContextMetrics ───────────────────────────────────────────────────────

describe("TimeToLiveRateLimiter — clearContextMetrics", () => {
   test("clearContextMetrics() with no arg clears all context entries", async () => {
      const limiter = new TimeToLiveRateLimiter<Ctx>({ contextKeyResolver: (ctx) => ctx.userId });
      limiter.init(ctxArgs("u1"));
      await limiter.check(ctxArgs("u1"));
      limiter.init(ctxArgs("u1", { query: stubQueryB }));
      await limiter.check(ctxArgs("u1", { query: stubQueryB }));

      limiter.clearContextMetrics();

      expect(limiter.contextMetrics.get("query-a")?.size ?? 0).toBe(0);
      expect(limiter.contextMetrics.get("query-b")?.size ?? 0).toBe(0);
   });

   test("clearContextMetrics(key) removes only that key across all hashes", async () => {
      const limiter = new TimeToLiveRateLimiter<Ctx>({ contextKeyResolver: (ctx) => ctx.userId });
      limiter.init(ctxArgs("u1"));
      await limiter.check(ctxArgs("u1"));
      limiter.init(ctxArgs("u1", { query: stubQueryB }));
      await limiter.check(ctxArgs("u1", { query: stubQueryB }));
      limiter.init(ctxArgs("u2"));
      await limiter.check(ctxArgs("u2"));

      limiter.clearContextMetrics("u1");

      expect(limiter.contextMetrics.get("query-a")?.has("u1")).toBe(false);
      expect(limiter.contextMetrics.get("query-b")?.has("u1")).toBe(false);
      expect(limiter.contextMetrics.get("query-a")?.has("u2")).toBe(true);
   });
});

// ── name ──────────────────────────────────────────────────────────────────────

describe("TimeToLiveRateLimiter — name", () => {
   test('defaults to "TimeToLiveRateLimiter" when not set', () => {
      const limiter = new TimeToLiveRateLimiter();
      expect(limiter.name).toMatchInlineSnapshot(`"TimeToLiveRateLimiter"`);
   });

   test("uses the name from options when set", () => {
      const limiter = new TimeToLiveRateLimiter({ name: "my-limiter" });
      expect(limiter.name).toMatchInlineSnapshot(`"my-limiter"`);
   });
});
