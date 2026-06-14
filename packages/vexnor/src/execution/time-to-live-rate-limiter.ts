import { SqlRunError } from "#/core/sql-run-error.js";
import { SqlErrorCode } from "#/core/sql-error-code.js";
import type {
   SqlQueryPipelinePlugin,
   SqlPipelineExecutionArgs,
   SqlPipelineEndArgs,
} from "./sql-query-pipeline-plugin.js";

export type QueryMetrics = {
   /** Number of currently executing instances of this query. */
   inFlight: number;
   /** Lifetime execution count (including in-flight). */
   totalCalls: number;
   /** Lifetime error count. */
   totalErrors: number;
   /** Rolling average duration of completed executions, in milliseconds. */
   avgDurationMs: number;
};

export type ContextMetrics = {
   /** The key derived from context via `contextKeyResolver`. */
   contextKey: string;
   /** Number of currently executing instances of this query for this context key. */
   inFlight: number;
   /** Lifetime execution count for this context key (including in-flight). */
   totalCalls: number;
   /** Lifetime error count for this context key. */
   totalErrors: number;
   /** Rolling average duration of completed executions for this context key, in milliseconds. */
   avgDurationMs: number;
   /** Timestamp of the last activity for TTL eviction purposes. */
   lastActivityAt: number;
};

export type LimitArgs<TContext extends Record<string, unknown> = Record<string, unknown>> =
   SqlPipelineExecutionArgs<TContext> & {
      /** Metrics for this query across all contexts at the time of the check. */
      queryMetrics: QueryMetrics;
      /** Metrics for this query scoped to the resolved context key, or `null` if no `contextKeyResolver` is configured. */
      contextMetrics: ContextMetrics | null;
   };

export type TimeToLiveRateLimiterOptions<TContext extends Record<string, unknown> = Record<string, unknown>> = {
   /**
    * Name identifying this plugin instance — used in error messages and warnings.
    * Defaults to `"TimeToLiveRateLimiter"`.
    */
   name?: string;
   /**
    * Derives a stable string key from the execution context (e.g. user ID, tenant ID).
    * When set, per-context metrics are tracked and passed to `limit()`.
    * When absent, `contextMetrics` is `null`.
    */
   contextKeyResolver?: (context: TContext) => string;
   /**
    * How long (in milliseconds) a context key's metrics are retained after its last activity.
    * Idle entries are evicted lazily on each `check()` call.
    * Defaults to 5 minutes.
    */
   contextMetricsTtlMs?: number;
   /**
    * Maximum number of concurrent executions of any single query.
    * Queries exceeding this limit are rejected with `QUERY_RATE_LIMITED`.
    */
   maxConcurrent?: number;
   /**
    * Maximum number of concurrent executions of any single query per context key.
    * Only applies when `contextKeyResolver` is configured.
    * Queries exceeding this limit are rejected with `QUERY_RATE_LIMITED`.
    */
   maxConcurrentPerContext?: number;
   /**
    * Custom limit hook — called before every query with current metrics snapshots.
    * Throw to reject. Runs after `maxConcurrent` and `maxConcurrentPerContext` checks.
    */
   limit?: (args: LimitArgs<TContext>) => void | Promise<void>;
   /**
    * Clock function — returns current timestamp in milliseconds.
    * Defaults to `Date.now`. Override in tests to control time.
    */
   now?: () => number;
};

/**
 * Rate limiter plugin with per-query and per-context concurrency tracking.
 *
 * Uses the `init()`/`end()` paired lifecycle for inFlight counting:
 * - `init()` — increments inFlight and totalCalls (always fires)
 * - `check()` — evaluates limits against current metrics (pure gate, no mutations)
 * - `end()` — decrements inFlight, updates avgDurationMs and totalErrors (always fires)
 */
export class TimeToLiveRateLimiter<
   TContext extends Record<string, unknown> = Record<string, unknown>,
> implements SqlQueryPipelinePlugin<TContext> {
   readonly name: string;
   private readonly now: () => number;
   private readonly _queryMetrics = new Map<string, QueryMetrics>();
   private readonly _contextMetrics = new Map<string, Map<string, ContextMetrics>>();
   private readonly options: TimeToLiveRateLimiterOptions<TContext>;

   constructor(options: TimeToLiveRateLimiterOptions<TContext> = {}) {
      this.name = options.name ?? "TimeToLiveRateLimiter";
      this.now = options.now ?? Date.now;
      this.options = options;
   }

   /** Per-query metrics across all contexts. Keyed by query hash. */
   get metrics(): ReadonlyMap<string, QueryMetrics> {
      return this._queryMetrics;
   }

   /** Per-query, per-context metrics. Outer key: query hash. Inner key: context key. */
   get contextMetrics(): ReadonlyMap<string, ReadonlyMap<string, ContextMetrics>> {
      return this._contextMetrics as ReadonlyMap<string, ReadonlyMap<string, ContextMetrics>>;
   }

   /**
    * Evicts context metrics for a specific key, or clears all context metrics if no key is given.
    * Useful for eager cleanup on logout or session end.
    */
   clearContextMetrics(contextKey?: string): void {
      if (contextKey === undefined) {
         this._contextMetrics.clear();
      } else {
         for (const inner of this._contextMetrics.values()) {
            inner.delete(contextKey);
         }
      }
   }

   /**
    * `init()` — always fires at pipeline start. Increments inFlight and totalCalls.
    */
   init(args: SqlPipelineExecutionArgs<TContext>): void {
      const { query } = args;
      const key = query.id;
      const qm = this.getOrCreateQueryMetrics(key);
      qm.inFlight++;
      qm.totalCalls++;

      const contextKey = this.options.contextKeyResolver?.(args.context);
      if (contextKey !== undefined) {
         const cm = this.getOrCreateContextMetrics(key, contextKey);
         cm.inFlight++;
         cm.totalCalls++;
         cm.lastActivityAt = this.now();
      }
   }

   /**
    * `check()` — pure gate. Evaluates concurrency limits against current metrics.
    * Throws to reject. Does not mutate metrics.
    */
   async check(args: SqlPipelineExecutionArgs<TContext>): Promise<void> {
      this.sweep();

      const { query, name } = args;
      const key = query.id;
      const qm = this._queryMetrics.get(key);
      const contextKey = this.options.contextKeyResolver?.(args.context);
      const cm = contextKey !== undefined ? this._contextMetrics.get(key)?.get(contextKey) ?? null : null;

      const { maxConcurrent, maxConcurrentPerContext } = this.options;

      if (maxConcurrent !== undefined && qm && qm.inFlight > maxConcurrent) {
         throw new SqlRunError(
            `Query "${name}" rejected — concurrency limit of ${maxConcurrent} reached (${qm.inFlight} in flight)`,
            query,
            { code: SqlErrorCode.QUERY_RATE_LIMITED, queryName: name },
         );
      }

      if (maxConcurrentPerContext !== undefined && cm !== null && cm.inFlight > maxConcurrentPerContext) {
         throw new SqlRunError(
            `Query "${name}" rejected — per-context concurrency limit of ${maxConcurrentPerContext} reached for key "${contextKey}" (${cm.inFlight} in flight)`,
            query,
            { code: SqlErrorCode.QUERY_RATE_LIMITED, queryName: name },
         );
      }

      if (this.options.limit && qm) {
         try {
            await this.options.limit({ ...args, queryMetrics: { ...qm }, contextMetrics: cm ? { ...cm } : null });
         } catch (err) {
            if (err instanceof SqlRunError) throw err;
            throw new SqlRunError(`Rate limit exceeded for query "${name}"`, query, {
               cause: err,
               code: SqlErrorCode.QUERY_RATE_LIMITED,
               queryName: name,
            });
         }
      }
   }

   /**
    * `end()` — always fires at pipeline end. Decrements inFlight, updates avgDurationMs and totalErrors.
    */
   end(args: SqlPipelineEndArgs<TContext>): void {
      const { query, error, durationMs } = args;
      const key = query.id;

      const qm = this._queryMetrics.get(key);
      if (!qm) return;

      qm.inFlight = Math.max(0, qm.inFlight - 1);
      const completed = qm.totalCalls - qm.inFlight;
      qm.avgDurationMs = qm.avgDurationMs + (durationMs - qm.avgDurationMs) / completed;
      if (error !== null) qm.totalErrors++;

      const contextKey = this.options.contextKeyResolver?.(args.context);
      if (contextKey !== undefined) {
         const cm = this._contextMetrics.get(key)?.get(contextKey);
         if (cm) {
            cm.inFlight = Math.max(0, cm.inFlight - 1);
            const cmCompleted = cm.totalCalls - cm.inFlight;
            cm.avgDurationMs = cm.avgDurationMs + (durationMs - cm.avgDurationMs) / cmCompleted;
            if (error !== null) cm.totalErrors++;
            cm.lastActivityAt = this.now();
         }
      }
   }

   private getOrCreateQueryMetrics(hash: string): QueryMetrics {
      let m = this._queryMetrics.get(hash);
      if (!m) {
         m = { inFlight: 0, totalCalls: 0, totalErrors: 0, avgDurationMs: 0 };
         this._queryMetrics.set(hash, m);
      }
      return m;
   }

   private getOrCreateContextMetrics(hash: string, contextKey: string): ContextMetrics {
      let inner = this._contextMetrics.get(hash);
      if (!inner) {
         inner = new Map();
         this._contextMetrics.set(hash, inner);
      }
      let m = inner.get(contextKey);
      if (!m) {
         m = { contextKey, inFlight: 0, totalCalls: 0, totalErrors: 0, avgDurationMs: 0, lastActivityAt: this.now() };
         inner.set(contextKey, m);
      }
      return m;
   }

   private sweep(): void {
      const ttl = this.options.contextMetricsTtlMs ?? 5 * 60 * 1000;
      const cutoff = this.now() - ttl;
      for (const inner of this._contextMetrics.values()) {
         for (const [key, m] of inner) {
            if (m.inFlight === 0 && m.lastActivityAt < cutoff) inner.delete(key);
         }
      }
   }
}
