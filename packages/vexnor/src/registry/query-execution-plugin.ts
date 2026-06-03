import type { VexnorPluginAny } from "#/plugin/vexnor-plugin.js";
import type { SqlQueryAny } from "#/core/query/sql-query.js";

/** Identity fields shared by `check`, `before`, and `after`. */
export type ExecutionArgs<TContext extends Record<string, unknown> = Record<string, unknown>> = {
   plugin: VexnorPluginAny;
   query: SqlQueryAny;
   queryHash: string;
   queryName: string;
   params: Record<string, unknown>;
   context: TContext;
   /** Source location of the query definition, or `null` if unavailable. */
   location: string | null;
};

/** Args passed to `after()` after a query completes — success or failure. */
export type AfterArgs<TContext extends Record<string, unknown> = Record<string, unknown>> = ExecutionArgs<TContext> & {
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
export interface QueryExecutionPlugin<TContext extends Record<string, unknown> = Record<string, unknown>> {
   /** Unique name identifying this plugin — used in error messages and warnings. */
   readonly name: string;
   check?(args: ExecutionArgs<TContext>): void | Promise<void>;
   before?(args: ExecutionArgs<TContext>): void;
   after?(args: AfterArgs<TContext>): void;
   onError?(
      err: unknown,
      phase: { before: ExecutionArgs<TContext> } | { after: AfterArgs<TContext> },
   ): void;
}
