import { ok } from "#/lib/assert.js";
import { SqlQuery, type SqlQueryAny } from "#/core/query/sql-query.js";
import type { VexnorPluginAny } from "#/plugin/vexnor-plugin.js";
import { SqlError } from "#/core/sql-error.js";
import { SqlRunError } from "#/core/sql-run-error.js";
import { SqlErrorCode } from "#/core/sql-error-code.js";
import type { SqlExecuteMode } from "#/core/query/sql-query-types.js";
import type { ExecutionArgs, QueryExecutionPlugin, AfterArgs } from "./query-execution-plugin.js";

export type ConnectionResolver = (args: ExecuteQueryArgs) => Promise<unknown>;
export type QueryMap = Record<string, SqlQueryAny>;

export type AuthorizeArgs<TRuntime extends Record<string, unknown> = Record<string, unknown>> = {
   plugin: VexnorPluginAny;
   query: SqlQueryAny;
   name: string;
   location: string | null;
   params: Record<string, unknown>;
   context: TRuntime;
};
export type AuthorizeHook<TRuntime extends Record<string, unknown> = Record<string, unknown>> = (
   args: AuthorizeArgs<TRuntime>,
) => void | Promise<void>;
export type ExecuteQueryArgs = {
   plugin: string;
   hash: string;
   params: Record<string, unknown>;
   location: string | null;
   mode: SqlExecuteMode;
};
const ExecuteQueryKeys: (keyof ExecuteQueryArgs)[] = ["plugin", "hash", "params", "location", "mode"];
export class BeforeQueryEvent<TRuntime extends Record<string, unknown> = Record<string, unknown>> extends Event {
   constructor(public readonly args: ExecutionArgs<TRuntime>) {
      super("beforeQuery");
   }
}

export class AfterQueryEvent<TRuntime extends Record<string, unknown> = Record<string, unknown>> extends Event {
   constructor(public readonly args: AfterArgs<TRuntime>) {
      super("afterQuery");
   }
}

export type QueryRegistryOptions<TRuntime extends Record<string, unknown> = Record<string, unknown>> = {
   /**
    * Maximum number of queries that may execute concurrently.
    * Queries exceeding this limit are rejected with `QUERY_RATE_LIMITED`.
    */
   maxConcurrent?: number;
   /**
    * Fallback error handler called when a plugin's `before()` or `after()` throws
    * and the plugin does not define its own `onError()`.
    */
   onPluginError?: (
      err: unknown,
      plugin: QueryExecutionPlugin<TRuntime>,
      phase: { before: ExecutionArgs<TRuntime> } | { after: AfterArgs<TRuntime> },
   ) => void;
};

export class QueryRegistry<TRuntime extends Record<string, unknown> = Record<string, unknown>> extends EventTarget {
   private readonly maps = new Map<string, Map<string, { query: SqlQueryAny; name: string }>>();
   private readonly plugins = new Map<string, VexnorPluginAny>();
   private readonly _authorizeHooks: AuthorizeHook<TRuntime>[] = [];
   private readonly _checkPlugins: QueryExecutionPlugin<TRuntime>[] = [];
   private readonly _options: QueryRegistryOptions<TRuntime>;
   private _inFlight = 0;

   constructor(options: QueryRegistryOptions<TRuntime> = {}) {
      super();
      this._options = options;
   }

   /**
    * Attaches a `QueryExecutionPlugin` to the registry.
    *
    * - `check()` is called before every query executes — throw to reject.
    * - `before()` is dispatched via EventTarget after checks pass, before the query runs.
    * - `after()` is dispatched via EventTarget after every query completes, success or failure.
    *
    * Returns an unsubscribe function that removes the plugin's listeners and check hook.
    */
   use(plugin: QueryExecutionPlugin<TRuntime>): () => void {
      if (plugin.check) {
         this._checkPlugins.push(plugin);
      }

      const beforeListener = plugin.before
         ? (e: Event) => {
              const args = (e as BeforeQueryEvent<TRuntime>).args;
              this.invokePluginListener(plugin, { before: args }, () => plugin.before!(args));
           }
         : null;

      const afterListener = plugin.after
         ? (e: Event) => {
              const args = (e as AfterQueryEvent<TRuntime>).args;
              this.invokePluginListener(plugin, { after: args }, () => plugin.after!(args));
           }
         : null;

      if (beforeListener) this.addEventListener("beforeQuery", beforeListener);
      if (afterListener) this.addEventListener("afterQuery", afterListener);

      return () => {
         const idx = this._checkPlugins.indexOf(plugin);
         if (idx >= 0) this._checkPlugins.splice(idx, 1);
         if (beforeListener) this.removeEventListener("beforeQuery", beforeListener);
         if (afterListener) this.removeEventListener("afterQuery", afterListener);
      };
   }

   /**
    * Registers an authorization hook called before every tagged query executes.
    *
    * The hook receives the query, its registered name, params, and the execution
    * context. Throw from the hook to deny execution — the error propagates as-is.
    * Multiple hooks accumulate and run sequentially; the first to throw stops the chain.
    *
    * @see {@link SqlQuery.authorize} for tagging queries.
    * @see {@link checkAuthorization} for startup validation.
    */
   registerAuthorization(hook: AuthorizeHook<TRuntime>): void {
      this._authorizeHooks.push(hook);
   }

   /**
    * Returns all registered queries that carry an `.authorize()` tag.
    * Useful for introspection and testing authorization coverage.
    */
   getAuthorizedQueries(): SqlQueryAny[] {
      return this.getQueries().filter((q) => q.authorization !== null);
   }

   /**
    * Returns all registered queries that have no `.authorize()` tag.
    * Useful for auditing which queries bypass authorization.
    */
   getUnauthorizedQueries(): SqlQueryAny[] {
      return this.getQueries().filter((q) => q.authorization === null);
   }

   /**
    * Startup validation — asserts that all `.authorize()`-tagged queries have
    * at least one authorization hook registered.
    *
    * Call this once after all queries are registered and before serving requests.
    * Throws {@link SqlError} with code `REGISTRY_NOT_AUTHORIZED` if the check fails.
    */
   checkAuthorization(): void {
      const authorized = this.getAuthorizedQueries();
      if (authorized.length > 0 && !this._authorizeHooks.length) {
         throw new SqlError(
            `${authorized.length} quer${authorized.length === 1 ? "y requires" : "ies require"} authorization but no hook is registered: ${authorized.map((q) => q.label).join(", ")}`,
            { code: SqlErrorCode.REGISTRY_NOT_AUTHORIZED },
         );
      }
   }

   /** Returns every query registered across all plugins. */
   getQueries(): SqlQueryAny[] {
      return Array.from(this.maps.values()).flatMap((map) => Array.from(map.values()).map((e) => e.query));
   }

   /** Returns all registered queries with their plugin name, hash, and display name. */
   getRegisteredQueries(): { plugin: string; hash: string; name: string; location: string | null; hashId: string }[] {
      const result: { plugin: string; hash: string; name: string; location: string | null; hashId: string }[] = [];
      for (const [plugin, map] of this.maps) {
         for (const [hash, { query, name }] of map) {
            result.push({ plugin, hash, name, location: query.location, hashId: query.hashId });
         }
      }
      return result;
   }

   getExecutionParams(request: unknown): ExecuteQueryArgs {
      if (!request || typeof request !== "object") {
         throw new SqlError("Expected request object with query name and params", {
            code: SqlErrorCode.QUERY_PARAMETERS_INVALID,
         });
      }

      return Object.fromEntries(
         ExecuteQueryKeys.map((key) => {
            const value = (request as Record<string, unknown>)[key];
            if (!value)
               throw new SqlError(`Missing required parameter in request: ${key}`, {
                  code: SqlErrorCode.QUERY_PARAMETERS_INVALID,
               });
            return [key, value];
         }),
      ) as ExecuteQueryArgs;
   }

   /**
    * Registers a set of queries under a plugin.
    *
    * Pass the module namespace directly — all `SqlQuery` exports are registered
    * under their variable names. Non-query exports are skipped with a warning.
    * Re-registering the same query is safe and idempotent.
    */
   async register(plugin: VexnorPluginAny, queries: QueryMap): Promise<void> {
      if (!this.plugins.has(plugin.name)) {
         this.plugins.set(plugin.name, plugin);
      }
      if (!this.maps.has(plugin.name)) {
         this.maps.set(plugin.name, new Map());
      }
      const map = this.maps.get(plugin.name)!;
      for (const [name, value] of Object.entries(queries)) {
         if (!(value instanceof SqlQuery)) {
            console.warn(`[vexnor] QueryRegistry.register: skipping "${name}" — not a SqlQuery instance`);
            continue;
         }
         map.set(await value.hash, { query: value, name });
      }
   }

   /**
    * Executes a registered query by plugin name and hash.
    *
    * Looks up the query by hash, runs authorization and check plugin hooks,
    * dispatches before/after events, executes against the resolved connection.
    * Always rejects with {@link SqlRunError} on failure.
    */
   async execute<TResult>(
      args: ExecuteQueryArgs | Record<string, unknown>,
      resolver: ConnectionResolver,
      context: TRuntime = {} as TRuntime,
   ): Promise<TResult> {
      const { hash, params, mode, location, plugin: pluginName } = this.getExecutionParams(args);
      const entry = this.maps.get(pluginName)?.get(hash);
      if (!entry) {
         throw new SqlError(`Unknown query hash: ${hash} for plugin: ${args.plugin}`, {
            code: SqlErrorCode.QUERY_NOT_FOUND,
         });
      }
      const { query, name } = entry;

      const plugin = this.plugins.get(pluginName);
      ok(plugin, `Unknown plugin: ${plugin}`);

      const mergedParams = this.mergeRuntimeParams(query, params, context);
      const executionArgs: ExecutionArgs<TRuntime> = {
         plugin,
         query,
         name,
         input: {
            plugin: pluginName,
            hash: hash,
            params,
            location,
            mode,
         },
         params: mergedParams,
         context,
      };
      const start = performance.now();
      let error: unknown | null = null;
      let started = false;
      try {
         await this.runAuthorize({ plugin, query, params: mergedParams, context, name: name, location });
         await this.runCheckPlugins(executionArgs);
         this.checkMaxConcurrent(name, query);
         started = true;
         this._inFlight++;
         this.dispatchEvent(new BeforeQueryEvent(executionArgs));
         const db = await resolver({ plugin: pluginName, hash, params, location, mode });
         const queryHandler = plugin.newQueryHandler(query);
         return await queryHandler.run({ db, params: mergedParams }, mode);
      } catch (err) {
         error = err;
         if (err instanceof SqlRunError) throw err.withOptions({ queryName: name });

         throw new SqlRunError(`Error executing query '${name}'`, query, {
            cause: err,
            queryName: name,
            code: SqlErrorCode.QUERY_EXECUTION_FAILED,
         });
      } finally {
         const durationMs = performance.now() - start;
         if (started) {
            this._inFlight--;
            const afterArgs: AfterArgs<TRuntime> = { ...executionArgs, durationMs, error };
            this.dispatchEvent(new AfterQueryEvent(afterArgs));
         }
      }
   }

   private mergeRuntimeParams(
      query: SqlQueryAny,
      params: Record<string, unknown>,
      runtime: Record<string, unknown>,
   ): Record<string, unknown> {
      const queryParams = query.params as Record<string, unknown> | null;
      if (!queryParams) return params;

      const hasRuntime = Object.values(queryParams).some((p) => (p as { isRuntime?: boolean }).isRuntime);
      if (!hasRuntime) return params;

      const merged: Record<string, unknown> = { ...params };
      for (const [key, p] of Object.entries(queryParams)) {
         if ((p as { isRuntime?: boolean }).isRuntime) merged[key] = runtime[key];
      }
      return merged;
   }

   private invokePluginListener(
      plugin: QueryExecutionPlugin<TRuntime>,
      phase: { before: ExecutionArgs<TRuntime> } | { after: AfterArgs<TRuntime> },
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
      plugin: QueryExecutionPlugin<TRuntime>,
      phase: { before: ExecutionArgs<TRuntime> } | { after: AfterArgs<TRuntime> },
   ): void {
      try {
         if (plugin.onError) {
            plugin.onError(err, phase);
         } else {
            this._options.onPluginError?.(err, plugin, phase);
         }
      } catch (handlerErr) {
         const phaseName = "before" in phase ? "before" : "after";
         process.emitWarning(
            `[vexnor] QueryExecutionPlugin "${plugin.name}" onError threw during "${phaseName}" phase: ${handlerErr}`,
         );
      }
   }

   private async runCheckPlugins(args: ExecutionArgs<TRuntime>) {
      for (const p of this._checkPlugins) {
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

   private async runAuthorize(args: AuthorizeArgs<TRuntime>) {
      const { query, name } = args;

      if (!query.authorization) return;

      if (!this._authorizeHooks.length) {
         throw new SqlRunError(
            `Query "${name}" requires authorization (tag: "${query.authorization}") but no authorize hook is registered`,
            query,
            { code: SqlErrorCode.QUERY_NOT_AUTHORIZED, queryName: name },
         );
      }

      for (const hook of this._authorizeHooks) {
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

   private checkMaxConcurrent(queryName: string, query: SqlQueryAny): void {
      const { maxConcurrent } = this._options;
      if (maxConcurrent !== undefined && this._inFlight >= maxConcurrent) {
         throw new SqlRunError(
            `Query "${queryName}" rejected — concurrency limit of ${maxConcurrent} reached (${this._inFlight} in flight)`,
            query,
            { code: SqlErrorCode.QUERY_RATE_LIMITED, queryName },
         );
      }
   }
}
