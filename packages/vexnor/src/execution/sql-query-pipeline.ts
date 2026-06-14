import { SqlError } from "#/core/sql-error.js";
import { SqlRunError } from "#/core/sql-run-error.js";
import { SqlErrorCode } from "#/core/sql-error-code.js";
import type { SqlQueryAny } from "#/core/query/sql-query.js";
import { runWithRetry } from "#/core/query/sql-retry.js";
import type { SqlRetryArgs, SqlRetryOptions, SqlRunOptions } from "#/core/query/sql-query-types.js";
import type {
   SqlPipelineExecutionArgs,
   SqlQueryPipelinePlugin,
   SqlPipelineEndArgs,
   SqlQueryExecutionPluginRef,
} from "./sql-query-pipeline-plugin.js";

export type AuthorizeArgs<TContext extends Record<string, unknown>> = {
   plugin: SqlQueryExecutionPluginRef;
   query: SqlQueryAny;
   name: string;
   params: Record<string, unknown>;
   context: TContext;
};

export type AuthorizeHook<TContext extends Record<string, unknown>> = (
   args: AuthorizeArgs<TContext>,
) => void | Promise<void>;

export class InitQueryEvent<TContext extends Record<string, unknown>> extends Event {
   constructor(public readonly args: SqlPipelineExecutionArgs<TContext>) {
      super("initQuery");
   }
}

export class BeforeQueryEvent<TContext extends Record<string, unknown>> extends Event {
   constructor(public readonly args: SqlPipelineExecutionArgs<TContext>) {
      super("beforeQuery");
   }
}

export class EndQueryEvent<TContext extends Record<string, unknown>> extends Event {
   constructor(public readonly args: SqlPipelineEndArgs<TContext>) {
      super("endQuery");
   }
}

export type SqlQueryPipelineOptions<TContext extends Record<string, unknown>> = {
   /**
    * Maximum number of queries that may execute concurrently.
    * Queries exceeding this limit are rejected with `QUERY_RATE_LIMITED`.
    */
   maxConcurrent?: number;
   /**
    * Retry policy for the database execution phase.
    *
    * Defaults to no retry. When enabled, the default predicate retries only
    * {@link SqlRunError}s marked `retryable`.
    */
   retry?: SqlQueryRetryOptions<TContext> | false;
   /**
    * Fallback error handler called when a plugin's `init()`, `before()`, or `end()` throws
    * and the plugin does not define its own `onError()`.
    */
   onPluginError?: (
      err: unknown,
      plugin: SqlQueryPipelinePlugin<TContext>,
      phase:
         | { init: SqlPipelineExecutionArgs<TContext> }
         | { before: SqlPipelineExecutionArgs<TContext> }
         | { end: SqlPipelineEndArgs<TContext> },
   ) => void;
};

export type SqlQueryRetryArgs<TContext extends Record<string, unknown>> = SqlRetryArgs<
   SqlPipelineExecutionArgs<TContext>
>;

export type SqlQueryRetryOptions<TContext extends Record<string, unknown>> = SqlRetryOptions<
   SqlPipelineExecutionArgs<TContext>
>;

export class SqlQueryPipeline<T extends { Context: Record<string, unknown> }> extends EventTarget {
   protected readonly authorizeHooks: AuthorizeHook<T["Context"]>[] = [];
   protected readonly checkPlugins: SqlQueryPipelinePlugin<T["Context"]>[] = [];
   protected readonly options: SqlQueryPipelineOptions<T["Context"]>;
   private inFlight = 0;

   constructor(options: SqlQueryPipelineOptions<T["Context"]> = {}) {
      super();
      this.options = options;
   }

   /**
    * Attaches a plugin to the pipeline.
    *
    * **Lifecycle hooks:**
    * - `init()` — always fires at pipeline start (paired with `end()`)
    * - `check()` — async gate, throw to reject
    * - `before()` — fires after checks pass, before query execution
    * - `end()` — always fires at pipeline end (paired with `init()`)
    *
    * Returns an unsubscribe function that removes the plugin.
    */
   use(plugin: SqlQueryPipelinePlugin<T["Context"]>): () => void {
      if (plugin.check) {
         this.checkPlugins.push(plugin);
      }

      const initListener = plugin.init
         ? (e: Event) => {
              const args = (e as InitQueryEvent<T["Context"]>).args;
              this.invokePluginListener(plugin, { init: args }, () => plugin.init!(args));
           }
         : null;

      const beforeListener = plugin.before
         ? (e: Event) => {
              const args = (e as BeforeQueryEvent<T["Context"]>).args;
              this.invokePluginListener(plugin, { before: args }, () => plugin.before!(args));
           }
         : null;

      const endListener = plugin.end
         ? (e: Event) => {
              const args = (e as EndQueryEvent<T["Context"]>).args;
              this.invokePluginListener(plugin, { end: args }, () => plugin.end!(args));
           }
         : null;

      if (initListener) this.addEventListener("initQuery", initListener);
      if (beforeListener) this.addEventListener("beforeQuery", beforeListener);
      if (endListener) this.addEventListener("endQuery", endListener);

      return () => {
         const idx = this.checkPlugins.indexOf(plugin);
         if (idx >= 0) this.checkPlugins.splice(idx, 1);
         if (initListener) this.removeEventListener("initQuery", initListener);
         if (beforeListener) this.removeEventListener("beforeQuery", beforeListener);
         if (endListener) this.removeEventListener("endQuery", endListener);
      };
   }

   /**
    * Registers an authorization hook called before every tagged query executes.
    *
    * Throw from the hook to deny execution — the error propagates as-is.
    * Multiple hooks accumulate and run sequentially; the first to throw stops the chain.
    */
   registerAuthorization(hook: AuthorizeHook<T["Context"]>): void {
      this.authorizeHooks.push(hook);
   }

   /**
    * Startup validation — asserts that all `.authorize()`-tagged queries have
    * at least one authorization hook registered.
    *
    * Throws {@link SqlError} with code `REGISTRY_NOT_AUTHORIZED` if the check fails.
    */
   checkAuthorization(queries: SqlQueryAny[]): void {
      const authorized = queries.filter((q) => q.authorization.length > 0);
      if (authorized.length > 0 && !this.authorizeHooks.length) {
         throw new SqlError(
            `${authorized.length} quer${authorized.length === 1 ? "y requires" : "ies require"} authorization but no hook is registered: ${authorized.map((q) => q.label).join(", ")}`,
            { code: SqlErrorCode.REGISTRY_NOT_AUTHORIZED },
         );
      }
   }

   /**
    * Clears all plugins, auth hooks, and event listeners.
    * Resets the pipeline to an empty state. Primarily useful for test isolation.
    */
   clear(): void {
      this.checkPlugins.length = 0;
      this.authorizeHooks.length = 0;
      const clone = new EventTarget();
      Object.setPrototypeOf(this, Object.getPrototypeOf(clone));
   }

   /**
    * Creates a new pipeline copying all plugins and auth hooks from the source.
    * Changes to either pipeline after the copy do not affect the other.
    */
   static from<TContext extends Record<string, unknown>>(
      source: SqlQueryPipeline<{ Context: TContext }>,
   ): SqlQueryPipeline<{ Context: TContext }> {
      const pipeline = new SqlQueryPipeline<{ Context: TContext }>(source.options);
      for (const hook of source.authorizeHooks) {
         pipeline.registerAuthorization(hook);
      }
      for (const plugin of source.checkPlugins) {
         pipeline.use(plugin);
      }
      return pipeline;
   }

   async runAuthorize(args: AuthorizeArgs<T["Context"]>): Promise<void> {
      const { query, name } = args;

      if (!query.authorization.length) return;

      if (!this.authorizeHooks.length) {
         throw new SqlRunError(
            `Query "${name}" requires authorization (tags: ${JSON.stringify(query.authorization)}) but no authorize hook is registered`,
            query,
            { code: SqlErrorCode.QUERY_NOT_AUTHORIZED, queryName: name },
         );
      }

      for (const hook of this.authorizeHooks) {
         try {
            await hook(args);
         } catch (err) {
            if (err instanceof SqlRunError) throw err;
            throw new SqlRunError(`Authorization denied for query "${name}"`, query, {
               cause: err,
               code: SqlErrorCode.QUERY_NOT_AUTHORIZED,
               queryName: name,
            });
         }
      }
   }

   async runCheckPlugins(args: SqlPipelineExecutionArgs<T["Context"]>): Promise<void> {
      for (const p of this.checkPlugins) {
         if (!p.check) continue;
         try {
            await p.check(args);
         } catch (err) {
            if (err instanceof SqlRunError) throw err;
            throw new SqlRunError(`Rate limit exceeded for query "${args.name}"`, args.query, {
               cause: err,
               code: SqlErrorCode.QUERY_RATE_LIMITED,
               queryName: args.name,
            });
         }
      }
   }

   /**
    * Executes a query through the full pipeline lifecycle.
    *
    * **Flow:** `init()` → `authorize()` → `check()` → `before()` → execute → `end()`
    *
    * `init()` and `end()` always fire as a pair regardless of outcome.
    */
   async execute<TResult>(
      executionArgs: SqlPipelineExecutionArgs<T["Context"]>,
      executeQuery: (attempt: number) => Promise<TResult>,
      options?: SqlRunOptions,
   ): Promise<TResult> {
      const { plugin, query, name, params, context } = executionArgs;
      const start = performance.now();
      let error: unknown | null = null;

      // init() — always fires at start
      this.dispatchEvent(new InitQueryEvent(executionArgs));

      try {
         await this.runAuthorize({
            plugin,
            query,
            params,
            context,
            name,
         });
         await this.runCheckPlugins(executionArgs);
         return await runWithRetry<TResult, SqlPipelineExecutionArgs<T["Context"]>>(
            options?.retry !== undefined ? options.retry : this.options.retry,
            executionArgs,
            async (attempt) => {
               this.checkMaxConcurrent(name, query);
               this.inFlight++;
               try {
                  this.dispatchEvent(new BeforeQueryEvent(executionArgs));
                  return await executeQuery(attempt);
               } finally {
                  this.inFlight--;
               }
            },
         );
      } catch (err) {
         error = err;
         if (err instanceof SqlRunError) throw err.withOptions({ queryName: name });
         throw new SqlRunError(`Error executing query '${name}'`, query, {
            cause: err,
            queryName: name,
            code: SqlErrorCode.QUERY_EXECUTION_FAILED,
         });
      } finally {
         // end() — always fires at end
         const durationMs = performance.now() - start;
         const endArgs = executionArgs as unknown as SqlPipelineEndArgs<T["Context"]>;
         endArgs.durationMs = durationMs;
         endArgs.error = error;
         this.dispatchEvent(new EndQueryEvent(endArgs));
      }
   }

   private checkMaxConcurrent(queryName: string, query: SqlQueryAny): void {
      const { maxConcurrent } = this.options;
      if (maxConcurrent !== undefined && this.inFlight >= maxConcurrent) {
         throw new SqlRunError(
            `Query "${queryName}" rejected — concurrency limit of ${maxConcurrent} reached (${this.inFlight} in flight)`,
            query,
            { code: SqlErrorCode.QUERY_RATE_LIMITED, queryName },
         );
      }
   }

   private invokePluginListener(
      plugin: SqlQueryPipelinePlugin<T["Context"]>,
      phase:
         | { init: SqlPipelineExecutionArgs<T["Context"]> }
         | { before: SqlPipelineExecutionArgs<T["Context"]> }
         | { end: SqlPipelineEndArgs<T["Context"]> },
      fn: () => void,
   ): void {
      try {
         fn();
      } catch (err) {
         this.handlePluginError(err, plugin, phase);
      }
   }

   private handlePluginError(
      err: unknown,
      plugin: SqlQueryPipelinePlugin<T["Context"]>,
      phase:
         | { init: SqlPipelineExecutionArgs<T["Context"]> }
         | { before: SqlPipelineExecutionArgs<T["Context"]> }
         | { end: SqlPipelineEndArgs<T["Context"]> },
   ): void {
      try {
         if (plugin.onError) {
            plugin.onError(err, phase);
         } else {
            this.options.onPluginError?.(err, plugin, phase);
         }
      } catch (handlerErr) {
         const phaseName = "init" in phase ? "init" : "before" in phase ? "before" : "end";
         const msg = `[vexnor] QueryExecutionPlugin "${plugin.name}" onError threw during "${phaseName}" phase: ${handlerErr}`;
         if (typeof process !== "undefined" && typeof process.emitWarning === "function") {
            process.emitWarning(msg);
         } else {
            console.warn(msg);
         }
      }
   }
}
