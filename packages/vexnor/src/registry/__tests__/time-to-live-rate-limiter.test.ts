import { describe, expect, test, vi } from "vitest";
import { TimeToLiveRateLimiter } from "#/registry/time-to-live-rate-limiter.js";
import { SqlRunError } from "#/core/sql-run-error.js";
import { SqlErrorCode } from "#/core/sql-error-code.js";
import type { ExecutionArgs, AfterArgs } from "#/registry/query-execution-plugin.js";

// ── minimal stubs ─────────────────────────────────────────────────────────────

const stubPlugin = {} as ExecutionArgs["plugin"];
const stubQuery = {} as ExecutionArgs["query"];

type Ctx = { userId: string };

function execArgs(overrides: Partial<ExecutionArgs> = {}): ExecutionArgs {
   return {
      plugin: stubPlugin,
      query: stubQuery,
      queryHash: "hash-a",
      queryName: "findAccounts",
      params: {},
      context: {},
      location: null,
      ...overrides,
   };
}

function ctxArgs(userId: string, overrides: Partial<ExecutionArgs<Ctx>> = {}): ExecutionArgs<Ctx> {
   return {
      plugin: stubPlugin,
      query: stubQuery,
      queryHash: "hash-a",
      queryName: "findAccounts",
      params: {},
      context: { userId },
      location: null,
      ...overrides,
   };
}

function afterArgs(overrides: Partial<AfterArgs> = {}): AfterArgs {
   return { ...execArgs(), durationMs: 10, error: null, ...overrides };
}

function ctxAfterArgs(userId: string, overrides: Partial<AfterArgs<Ctx>> = {}): AfterArgs<Ctx> {
   return { ...ctxArgs(userId), durationMs: 10, error: null, ...overrides };
}

// ── metrics tracking ──────────────────────────────────────────────────────────

describe("TimeToLiveRateLimiter — metrics tracking", () => {
   test("check increments inFlight and totalCalls", async () => {
      const limiter = new TimeToLiveRateLimiter();
      await limiter.check(execArgs());

      expect(limiter.metrics.get("hash-a")).toMatchInlineSnapshot(`
        {
          "avgDurationMs": 0,
          "inFlight": 1,
          "totalCalls": 1,
          "totalErrors": 0,
        }
      `);
   });

   test("after() decrements inFlight and updates avgDurationMs", async () => {
      const limiter = new TimeToLiveRateLimiter();
      await limiter.check(execArgs());
      await limiter.after(afterArgs({ durationMs: 20 }));

      expect(limiter.metrics.get("hash-a")).toMatchInlineSnapshot(`
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
      await limiter.check(execArgs());
      await limiter.check(execArgs());
      await limiter.after(afterArgs({ durationMs: 10 }));
      await limiter.after(afterArgs({ durationMs: 30 }));

      const m = limiter.metrics.get("hash-a")!;
      expect(m.avgDurationMs).toBe(20);
      expect(m.totalCalls).toBe(2);
      expect(m.inFlight).toBe(0);
   });

   test("after() increments totalErrors on failure", async () => {
      const limiter = new TimeToLiveRateLimiter();
      await limiter.check(execArgs());
      await limiter.after(afterArgs({ error: new Error("oops") }));

      expect(limiter.metrics.get("hash-a")!.totalErrors).toBe(1);
   });

   test("after() is a no-op when hash is unknown", () => {
      const limiter = new TimeToLiveRateLimiter();
      expect(() => limiter.after(afterArgs({ queryHash: "unknown" }))).not.toThrow();
   });

   test("tracks separate metrics per query hash", async () => {
      const limiter = new TimeToLiveRateLimiter();
      await limiter.check(execArgs({ queryHash: "hash-a" }));
      await limiter.check(execArgs({ queryHash: "hash-b" }));
      await limiter.after(afterArgs({ queryHash: "hash-a", durationMs: 5 }));

      expect(limiter.metrics.get("hash-a")).toMatchInlineSnapshot(`
        {
          "avgDurationMs": 5,
          "inFlight": 0,
          "totalCalls": 1,
          "totalErrors": 0,
        }
      `);
      expect(limiter.metrics.get("hash-b")).toMatchInlineSnapshot(`
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
   test("check and after() track per-context metrics when contextKeyResolver is set", async () => {
      const limiter = new TimeToLiveRateLimiter<Ctx>({ contextKeyResolver: (ctx) => ctx.userId });

      await limiter.check(ctxArgs("u1"));
      await limiter.after(ctxAfterArgs("u1", { durationMs: 15 }));

      const cm = limiter.contextMetrics.get("hash-a")?.get("u1");
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
      await limiter.check(execArgs());

      expect(limiter.contextMetrics.size).toBe(0);
   });

   test("separate context keys are tracked independently", async () => {
      const limiter = new TimeToLiveRateLimiter<Ctx>({ contextKeyResolver: (ctx) => ctx.userId });

      await limiter.check(ctxArgs("u1"));
      await limiter.check(ctxArgs("u2"));
      await limiter.after(ctxAfterArgs("u1", { durationMs: 10 }));
      await limiter.after(ctxAfterArgs("u2", { durationMs: 20 }));

      expect(limiter.contextMetrics.get("hash-a")?.get("u1")?.avgDurationMs).toBe(10);
      expect(limiter.contextMetrics.get("hash-a")?.get("u2")?.avgDurationMs).toBe(20);
   });
});

// ── maxConcurrent ─────────────────────────────────────────────────────────────

describe("TimeToLiveRateLimiter — maxConcurrent", () => {
   test("rejects when inFlight reaches maxConcurrent", async () => {
      const limiter = new TimeToLiveRateLimiter({ maxConcurrent: 1 });
      await limiter.check(execArgs());

      await expect(limiter.check(execArgs())).rejects.toMatchInlineSnapshot(
         `[SqlRunError: Query "findAccounts" rejected — concurrency limit of 1 reached (1 in flight)]`,
      );
   });

   test("allows execution after inFlight drops back below limit", async () => {
      const limiter = new TimeToLiveRateLimiter({ maxConcurrent: 1 });
      await limiter.check(execArgs());
      await limiter.after(afterArgs());

      await expect(limiter.check(execArgs())).resolves.toBeUndefined();
   });

   test("does not reject below the limit", async () => {
      const limiter = new TimeToLiveRateLimiter({ maxConcurrent: 2 });
      await limiter.check(execArgs());
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
      await limiter.check(ctxArgs("u1"));

      await expect(limiter.check(ctxArgs("u1"))).rejects.toMatchInlineSnapshot(
         `[SqlRunError: Query "findAccounts" rejected — per-context concurrency limit of 1 reached for key "u1" (1 in flight)]`,
      );
   });

   test("does not reject a different context key", async () => {
      const limiter = new TimeToLiveRateLimiter<Ctx>({
         contextKeyResolver: (ctx) => ctx.userId,
         maxConcurrentPerContext: 1,
      });
      await limiter.check(ctxArgs("u1"));

      await expect(limiter.check(ctxArgs("u2"))).resolves.toBeUndefined();
   });

   test("does not apply when no contextKeyResolver is configured", async () => {
      const limiter = new TimeToLiveRateLimiter({ maxConcurrentPerContext: 1 });
      await limiter.check(execArgs());
      await expect(limiter.check(execArgs())).resolves.toBeUndefined();
   });
});

// ── custom limit hook ─────────────────────────────────────────────────────────

describe("TimeToLiveRateLimiter — limit hook", () => {
   test("limit hook is called with metrics snapshots", async () => {
      const limit = vi.fn();
      const limiter = new TimeToLiveRateLimiter<Ctx>({ contextKeyResolver: (ctx) => ctx.userId, limit });

      await limiter.check(ctxArgs("u1"));

      expect(limit).toHaveBeenCalledOnce();
      expect(limit).toHaveBeenCalledWith(
         expect.objectContaining({
            queryMetrics: { inFlight: 0, totalCalls: 0, totalErrors: 0, avgDurationMs: 0 },
            contextMetrics: expect.objectContaining({ contextKey: "u1", inFlight: 0, totalCalls: 0 }),
         }),
      );
   });

   test("limit hook throwing wraps error in SqlRunError with QUERY_RATE_LIMITED", async () => {
      const limiter = new TimeToLiveRateLimiter({
         limit: () => { throw new Error("too many"); },
      });

      await expect(limiter.check(execArgs())).rejects.toMatchInlineSnapshot(
         `[SqlRunError: Rate limit exceeded for query "findAccounts". (Error: too many)]`,
      );
   });

   test("limit hook throwing SqlRunError propagates as-is", async () => {
      const limiter = new TimeToLiveRateLimiter({
         limit: ({ query, queryName }) => {
            throw new SqlRunError("custom", query, { queryName, code: SqlErrorCode.QUERY_RATE_LIMITED });
         },
      });

      await expect(limiter.check(execArgs())).rejects.toMatchInlineSnapshot(
         `[SqlRunError: custom]`,
      );
   });

   test("limit hook runs after maxConcurrent check — not called on second rejected check", async () => {
      const limit = vi.fn();
      const limiter = new TimeToLiveRateLimiter({ maxConcurrent: 1, limit });
      await limiter.check(execArgs());

      await expect(limiter.check(execArgs())).rejects.toThrow("concurrency limit");
      expect(limit).toHaveBeenCalledOnce();
   });
});

// ── TTL sweep ─────────────────────────────────────────────────────────────────

describe("TimeToLiveRateLimiter — TTL sweep", () => {
   test("idle context entries are evicted after TTL on next check()", async () => {
      const limiter = new TimeToLiveRateLimiter<Ctx>({
         contextKeyResolver: (ctx) => ctx.userId,
         contextMetricsTtlMs: 1,
      });

      await limiter.check(ctxArgs("u1"));
      await limiter.after(ctxAfterArgs("u1"));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (limiter as any)._contextMetrics.get("hash-a").get("u1").lastActivityAt = Date.now() - 100;

      await limiter.check(ctxArgs("u2"));

      expect(limiter.contextMetrics.get("hash-a")?.has("u1")).toBe(false);
      expect(limiter.contextMetrics.get("hash-a")?.has("u2")).toBe(true);
   });

   test("in-flight context entries are not evicted by sweep", async () => {
      const limiter = new TimeToLiveRateLimiter<Ctx>({
         contextKeyResolver: (ctx) => ctx.userId,
         contextMetricsTtlMs: 1,
      });

      await limiter.check(ctxArgs("u1")); // inFlight = 1, not yet recorded

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (limiter as any)._contextMetrics.get("hash-a").get("u1").lastActivityAt = Date.now() - 100;

      await limiter.check(ctxArgs("u2"));

      expect(limiter.contextMetrics.get("hash-a")?.has("u1")).toBe(true);
   });
});

// ── clearContextMetrics ───────────────────────────────────────────────────────

describe("TimeToLiveRateLimiter — clearContextMetrics", () => {
   test("clearContextMetrics() with no arg clears all context entries", async () => {
      const limiter = new TimeToLiveRateLimiter<Ctx>({ contextKeyResolver: (ctx) => ctx.userId });
      await limiter.check(ctxArgs("u1"));
      await limiter.check(ctxArgs("u1", { queryHash: "hash-b" }));

      limiter.clearContextMetrics();

      expect(limiter.contextMetrics.get("hash-a")?.size ?? 0).toBe(0);
      expect(limiter.contextMetrics.get("hash-b")?.size ?? 0).toBe(0);
   });

   test("clearContextMetrics(key) removes only that key across all hashes", async () => {
      const limiter = new TimeToLiveRateLimiter<Ctx>({ contextKeyResolver: (ctx) => ctx.userId });
      await limiter.check(ctxArgs("u1"));
      await limiter.check(ctxArgs("u1", { queryHash: "hash-b" }));
      await limiter.check(ctxArgs("u2"));

      limiter.clearContextMetrics("u1");

      expect(limiter.contextMetrics.get("hash-a")?.has("u1")).toBe(false);
      expect(limiter.contextMetrics.get("hash-b")?.has("u1")).toBe(false);
      expect(limiter.contextMetrics.get("hash-a")?.has("u2")).toBe(true);
   });
});

// ── name ──────────────────────────────────────────────────────────────────────

describe("TimeToLiveRateLimiter — name", () => {
   test("defaults to \"TimeToLiveRateLimiter\" when not set", () => {
      const limiter = new TimeToLiveRateLimiter();
      expect(limiter.name).toMatchInlineSnapshot(`"TimeToLiveRateLimiter"`);
   });

   test("uses the name from options when set", () => {
      const limiter = new TimeToLiveRateLimiter({ name: "my-limiter" });
      expect(limiter.name).toMatchInlineSnapshot(`"my-limiter"`);
   });
});
