import type { SqlQueryAny } from "#src/core/query/sql-query.js";
import { SqlExecuteMode } from "#src/core/query/sql-query-types.js";

export type SqlQueryExecutionPluginRef = {
   readonly name: string;
   readonly driver?: string;
   readonly dialect?: string;
};

/** Identity fields shared across all plugin lifecycle hooks. */
export type SqlPipelineExecutionArgs<TContext extends Record<string, unknown> = Record<string, unknown>> = {
   plugin: SqlQueryExecutionPluginRef;
   query: SqlQueryAny;
   name: string;
   mode: SqlExecuteMode;
   params: Record<string, unknown>;
   remote: {
      plugin: string;
      hash: string;
      mode: SqlExecuteMode;
      params: Record<string, unknown>;
      location: string | null;
      name: string | null;
   } | null;
   context: TContext;
};

/** Args passed to `end()` after a query completes — success or failure. */
export type SqlPipelineEndArgs<TContext extends Record<string, unknown> = Record<string, unknown>> =
   SqlPipelineExecutionArgs<TContext> & {
      durationMs: number;
      /** `null` on success. */
      error: unknown | null;
   };

/**
 * A composable plugin that plugs into the query pipeline via `pipeline.use()`.
 *
 * All methods are optional — implement only what the plugin needs.
 *
 * **Lifecycle flow:**
 * ```
 * init() → authorize() → check() → before() → execute query → end()
 * ```
 *
 * - `init()` — sync observer, **always** fires at the start of every pipeline execution. Paired with `end()`.
 * - `check()` — async gate called after authorization. Throw to reject the query.
 * - `before()` — sync observer called after all checks pass, immediately before query execution.
 * - `end()` — sync observer, **always** fires at the end of every pipeline execution (success, failure, or rejection). Paired with `init()`.
 * - `onError()` — called when `init()`, `before()`, or `end()` throws, with the original args for context.
 *
 * `init()` and `end()` are guaranteed to always fire as a pair, regardless of whether
 * authorization or checks reject the query. Use them for resource tracking (e.g. inFlight counters).
 *
 * `before()` only fires when the query is about to execute against the database —
 * use it for tracing spans or last-moment setup.
 */
export interface SqlQueryPipelinePlugin<TContext extends Record<string, unknown> = Record<string, unknown>> {
   /** Unique name identifying this plugin — used in error messages and warnings. */
   readonly name: string;
   /** Always fires at pipeline start. Paired with `end()`. */
   init?(args: SqlPipelineExecutionArgs<TContext>): void;
   /** Async gate — throw to reject the query. */
   check?(args: SqlPipelineExecutionArgs<TContext>): void | Promise<void>;
   /** Fires after checks pass, immediately before query execution. */
   before?(args: SqlPipelineExecutionArgs<TContext>): void;
   /** Always fires at pipeline end (success or failure). Paired with `init()`. */
   end?(args: SqlPipelineEndArgs<TContext>): void;
   /** Called when `init()`, `before()`, or `end()` throws. */
   onError?(
      err: unknown,
      phase:
         | { init: SqlPipelineExecutionArgs<TContext> }
         | { before: SqlPipelineExecutionArgs<TContext> }
         | { end: SqlPipelineEndArgs<TContext> },
   ): void;
}
