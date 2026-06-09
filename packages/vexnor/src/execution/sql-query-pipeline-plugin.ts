import type { SqlQueryAny } from "#/core/query/sql-query.js";
import { SqlExecuteMode } from "#/core/query/sql-query-types.js";

export type SqlQueryExecutionPluginRef = {
   readonly name: string;
   readonly driver?: string;
   readonly dialect?: string;
};

/** Identity fields shared by `check`, `before`, and `after`. */
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

/** Args passed to `after()` after a query completes — success or failure. */
export type SqlPipelineAfterArgs<TContext extends Record<string, unknown> = Record<string, unknown>> =
   SqlPipelineExecutionArgs<TContext> & {
      durationMs: number;
      /** `null` on success. */
      error: unknown | null;
   };

/**
 * A composable plugin that plugs into `QueryRegistry` via `registry.use()`.
 *
 * All methods are optional — implement only what the plugin needs.
 *
 * - `check()` — async gate called before execution. Throw to reject the query.
 * - `before()` — sync observer called after all checks pass, before the query runs. Fire-and-forget via EventTarget.
 * - `after()` — sync observer called after every query completes, success or failure. Fire-and-forget via EventTarget.
 * - `onError()` — called when `before()` or `after()` throws, with the original args for context.
 */
export interface SqlQueryPipelinePlugin<TContext extends Record<string, unknown> = Record<string, unknown>> {
   /** Unique name identifying this plugin — used in error messages and warnings. */
   readonly name: string;
   check?(args: SqlPipelineExecutionArgs<TContext>): void | Promise<void>;
   before?(args: SqlPipelineExecutionArgs<TContext>): void;
   after?(args: SqlPipelineAfterArgs<TContext>): void;
   onError?(
      err: unknown,
      phase: { before: SqlPipelineExecutionArgs<TContext> } | { after: SqlPipelineAfterArgs<TContext> },
   ): void;
}
