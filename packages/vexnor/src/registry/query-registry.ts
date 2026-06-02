import { ok } from "#/lib/assert.js";
import { SqlQuery, type SqlQueryAny } from "#/core/query/sql-query.js";
import type { VexnorPluginAny } from "#/plugin/vexnor-plugin.js";
import { SqlError } from "#/core/sql-error.js";
import { SqlRunError } from "#/core/sql-run-error.js";
import { SqlErrorCode } from "#/core/sql-error-code.js";

export type ConnectionResolver = (pluginName: string) => Promise<unknown>;
export type QueryMap = Record<string, SqlQueryAny>;

export type AuthorizeArgs<TContext extends Record<string, unknown> = Record<string, unknown>> = {
   plugin: VexnorPluginAny;
   query: SqlQueryAny;
   queryName: string;
   params: Record<string, unknown>;
   context: TContext;
};
export type AuthorizeHook<TContext extends Record<string, unknown> = Record<string, unknown>> = (
   args: AuthorizeArgs<TContext>,
) => void | Promise<void>;

export type RateLimitArgs<TContext extends Record<string, unknown> = Record<string, unknown>> = {
   plugin: VexnorPluginAny;
   query: SqlQueryAny;
   queryName: string;
   params: Record<string, unknown>;
   context: TContext;
   /** Number of queries currently in flight at the time this query was submitted. */
   inFlight: number;
};
export type RateLimitHook<TContext extends Record<string, unknown> = Record<string, unknown>> = (
   args: RateLimitArgs<TContext>,
) => void | Promise<void>;

export type AuditLogArgs<TContext extends Record<string, unknown> = Record<string, unknown>> = {
   plugin: VexnorPluginAny;
   query: SqlQueryAny;
   queryName: string | null;
   params: Record<string, unknown>;
   context: TContext;
   durationMs: number;
   error: unknown | null;
   location: string | null;
};

export class AuditLogEvent<TContext extends Record<string, unknown> = Record<string, unknown>> extends Event {
   constructor(public readonly args: AuditLogArgs<TContext>) {
      super("auditLog");
   }
}

export type QueryRegistryOptions = {
   /**
    * Maximum number of queries that may execute concurrently.
    * Queries exceeding this limit are rejected with `QUERY_RATE_LIMITED`.
    */
   maxConcurrent?: number;
};

export class QueryRegistry<TContext extends Record<string, unknown> = Record<string, unknown>> extends EventTarget {
   private readonly maps = new Map<string, Map<string, { query: SqlQueryAny; name: string }>>();
   private readonly plugins = new Map<string, VexnorPluginAny>();
   private readonly _authorizeHooks: AuthorizeHook<TContext>[] = [];
   private readonly _rateLimitHooks: RateLimitHook<TContext>[] = [];
   private readonly _options: QueryRegistryOptions;
   private _inFlight = 0;

   constructor(options: QueryRegistryOptions = {}) {
      super();
      this._options = options;
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
   registerAuthorization(hook: AuthorizeHook<TContext>): void {
      this._authorizeHooks.push(hook);
   }

   /**
    * Registers a rate-limit hook called before every query executes.
    *
    * Use this to implement per-user request rate limiting (e.g. token bucket).
    * The hook receives `inFlight` — the current concurrency count — alongside
    * the query and context. Throw to reject the query with `QUERY_RATE_LIMITED`.
    * For simple concurrency limiting, use the `maxConcurrent` constructor option instead.
    */
   registerRateLimit(hook: RateLimitHook<TContext>): void {
      this._rateLimitHooks.push(hook);
   }

   /**
    * Registers an audit log listener called after every query execution — whether
    * it succeeded or failed. Receives timing, query identity, params, and the error
    * if one occurred.
    *
    * Use this for logging, metrics, or OpenTelemetry span creation.
    * Multiple listeners accumulate and all fire regardless of each other's outcome.
    */
   registerAuditLog(listener: (event: AuditLogEvent<TContext>) => void): void {
      this.addEventListener("auditLog", listener as Parameters<EventTarget["addEventListener"]>[1]);
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
    * Looks up the query by hash, runs authorization and rate-limit checks,
    * executes against the resolved connection, and fires the audit log.
    * Always rejects with {@link SqlRunError} on failure.
    */
   async execute<TResult>(
      pluginName: string,
      hash: string,
      params: Record<string, unknown>,
      resolver: ConnectionResolver,
      context: TContext = {} as TContext,
   ): Promise<TResult> {
      const entry = this.maps.get(pluginName)?.get(hash);
      if (!entry) {
         throw new SqlError(`Unknown query hash: ${hash} for plugin: ${pluginName}`, {
            code: SqlErrorCode.QUERY_NOT_FOUND,
         });
      }
      const { query, name } = entry;

      const plugin = this.plugins.get(pluginName);
      ok(plugin, `Unknown plugin: ${pluginName}`);

      const start = performance.now();
      let error: unknown | null = null;
      try {
         await this.runAuthorize({ plugin, query, params, context, queryName: name });
         await this.runRateLimit({ plugin, query, params, context, queryName: name, inFlight: this._inFlight });
         this._inFlight++;

         const db = await resolver(pluginName);
         const queryHandler = plugin.newQueryHandler(query);
         return await queryHandler.run({ db, params });
      } catch (err) {
         error = err;
         if (err instanceof SqlRunError) throw err.withOptions({ queryName: name });

         throw new SqlRunError(`Error executing query '${name}'`, query, {
            cause: err,
            queryName: name,
            code: SqlErrorCode.QUERY_EXECUTION_FAILED,
         });
      } finally {
         this._inFlight--;
         this.dispatchEvent(
            new AuditLogEvent({
               plugin,
               query,
               queryName: name,
               params,
               context,
               durationMs: performance.now() - start,
               error,
               location: query.location,
            }),
         );
      }
   }

   private async runAuthorize(args: AuthorizeArgs<TContext>) {
      const { query, queryName } = args;

      if (!query.authorization) return;

      if (!this._authorizeHooks.length) {
         throw new SqlRunError(
            `Query "${queryName}" requires authorization (tag: "${query.authorization}") but no authorize hook is registered`,
            query,
            { code: SqlErrorCode.QUERY_NOT_AUTHORIZED, queryName },
         );
      }

      for (const hook of this._authorizeHooks) {
         try {
            await hook(args);
         } catch (err) {
            if (err instanceof SqlRunError) throw err;

            throw new SqlRunError(`Authorization denied for query "${queryName}"`, query, {
               cause: err,
               code: SqlErrorCode.QUERY_NOT_AUTHORIZED,
               queryName,
            });
         }
      }
   }

   private async runRateLimit(args: RateLimitArgs<TContext>) {
      const { maxConcurrent } = this._options;

      if (maxConcurrent !== undefined && this._inFlight >= maxConcurrent) {
         throw new SqlRunError(
            `Query "${args.queryName}" rejected — concurrency limit of ${maxConcurrent} reached`,
            args.query,
            { code: SqlErrorCode.QUERY_RATE_LIMITED, queryName: args.queryName },
         );
      }

      for (const hook of this._rateLimitHooks) {
         try {
            await hook(args);
         } catch (err) {
            if (err instanceof SqlRunError) throw err;

            throw new SqlRunError(`Rate limit exceeded for query "${args.queryName}"`, args.query, {
               cause: err,
               code: SqlErrorCode.QUERY_RATE_LIMITED,
               queryName: args.queryName,
            });
         }
      }
   }
}
