import { ok } from "#/lib/assert.js";
import { SqlQuery, type SqlQueryAny } from "#/core/query/sql-query.js";
import type { VexnorPluginAny } from "#/plugin/vexnor-plugin.js";
import { SqlError } from "#/core/sql-error.js";
import { SqlRunError } from "#/core/sql-run-error.js";

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

/**
 * A `Promise<T>` that documents its rejection type as `E`.
 * TypeScript does not natively type promise rejections — this is a
 * documentation-only brand that makes the error type visible at call sites
 * and enables typed `.catch()` without casting.
 */
export type TypedPromise<T, E> = Promise<T> & { readonly __errorType?: E };

export class QueryRegistry<TContext extends Record<string, unknown> = Record<string, unknown>> extends EventTarget {
   private readonly maps = new Map<string, Map<string, { query: SqlQueryAny; name: string }>>();
   private readonly plugins = new Map<string, VexnorPluginAny>();
   private readonly _authorizeHooks: AuthorizeHook<TContext>[] = [];

   registerAuthorization(hook: AuthorizeHook<TContext>): void {
      this._authorizeHooks.push(hook);
   }

   registerAuditLog(listener: (event: AuditLogEvent<TContext>) => void): void {
      this.addEventListener("auditLog", listener as Parameters<EventTarget["addEventListener"]>[1]);
   }

   /** Returns all registered queries that carry an `.authorize()` tag. */
   getAuthorizedQueries(): SqlQueryAny[] {
      return this.getQueries().filter((q) => q.authorization !== null);
   }

   /** Returns all registered queries that have no `.authorize()` tag. */
   getUnauthorizedQueries(): SqlQueryAny[] {
      return this.getQueries().filter((q) => q.authorization === null);
   }

   /**
    * Asserts that all authorized queries have a hook registered.
    *
    * Call this at startup to fail fast if any tagged query has no hook.
    * Throws if authorized queries exist, but no hook is registered.
    */
   checkAuthorization(): void {
      const authorized = this.getAuthorizedQueries();
      if (authorized.length > 0 && !this._authorizeHooks.length) {
         throw new SqlError(
            `${authorized.length} quer${authorized.length === 1 ? "y requires" : "ies require"} authorization but no hook is registered: ${authorized.map((q) => q.label).join(", ")}`,
         );
      }
   }

   /** Returns every query registered across all plugins. */
   getQueries(): SqlQueryAny[] {
      return Array.from(this.maps.values()).flatMap((map) => Array.from(map.values()).map((e) => e.query));
   }

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

   async authorize(args: AuthorizeArgs<TContext>) {
      const { query, queryName } = args;
      if (!query.authorization) return;

      if (!this._authorizeHooks.length) {
         throw new SqlRunError(
            `Query requires authorization (tag: "${query.authorization}") but no authorize hook is registered`,
            query,
            { queryName },
         );
      }

      for (const hook of this._authorizeHooks) {
         await hook(args);
      }
   }

   /**
    * Executes a registered query by plugin name and hash.
    *
    * Always rejects with {@link SqlRunError} on failure — including connection
    * errors, query build errors, and authorization failures.
    */
   async execute(
      pluginName: string,
      hash: string,
      params: Record<string, unknown>,
      resolver: ConnectionResolver,
      context: TContext = {} as TContext,
   ): Promise<unknown & { readonly __errorType?: SqlRunError }> {
      const entry = this.maps.get(pluginName)?.get(hash);
      if (!entry) {
         throw new SqlError(`Unknown query hash: ${hash} for plugin: ${pluginName}`);
      }
      const { query, name } = entry;

      const plugin = this.plugins.get(pluginName);
      ok(plugin, `Unknown plugin: ${pluginName}`);

      const start = performance.now();
      let error: unknown | null = null;
      try {
         await this.authorize({ plugin, query, params, context, queryName: name });
         const db = await resolver(pluginName);
         const queryHandler = plugin.newQueryHandler(query);
         return await queryHandler.run({ db, params });
      } catch (err) {
         error = err;
         throw new SqlRunError(`Error executing query '${name}'`, query, {
            cause: err,
            queryName: name,
         });
      } finally {
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
}
