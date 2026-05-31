import { ok } from "#/lib/assert.js";
import { SqlQuery, type SqlQueryAny } from "#/core/query/sql-query.js";
import type { VexnorPluginAny } from "#/plugin/vexnor-plugin.js";
import { SqlExecError } from "#/cli/exec/sql-exec-error.js";
import { SqlError } from "#/core/sql-error.js";
import { SqlRunError } from "#/core/sql-run-error.js";

export type ConnectionResolver = (pluginName: string) => Promise<unknown>;
export type QueryMap = Record<string, SqlQueryAny>;

export type AuthorizeArgs = {
   plugin: VexnorPluginAny;
   query: SqlQueryAny;
   params: Record<string, unknown>;
};
export type AuthorizeHook = (args: AuthorizeArgs) => void | Promise<void>;

export type AuditLogArgs = {
   plugin: VexnorPluginAny;
   query: SqlQueryAny;
   name: string | null;
   params: Record<string, unknown>;
   durationMs: number;
   error: unknown | null;
   location: string | null;
};

export class AuditLogEvent extends Event {
   constructor(public readonly args: AuditLogArgs) {
      super("auditLog");
   }
}

export class QueryRegistry extends EventTarget {
   private readonly maps = new Map<string, Map<string, { query: SqlQueryAny; name: string | null }>>();
   private readonly plugins = new Map<string, VexnorPluginAny>();
   private readonly _authorizeHooks: AuthorizeHook[] = [];

   /**
    * Registers a hook called before every authorized query execution.
    *
    * Throw inside the hook to deny execution.
    */
   registerAuthorization(hook: AuthorizeHook): void {
      this._authorizeHooks.push(hook);
   }

   /**
    * Registers an audit log listener called after every query execution —
    * success, failure, or authorization denial.
    *
    * Use for observability and compliance (SOC2, HIPAA).
    */
   registerAuditLog(listener: (event: AuditLogEvent) => void): void {
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
         throw new SqlExecError(
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

   async authorize(args: AuthorizeArgs) {
      const { query } = args;
      if (!query.authorization) return;

      if (!this._authorizeHooks.length) {
         throw new SqlRunError(
            `Query requires authorization (tag: "${query.authorization}") but no authorize hook is registered`,
            query,
            {},
         );
      }
      for (const hook of this._authorizeHooks) {
         await hook(args);
      }
   }

   async execute(
      pluginName: string,
      hash: string,
      params: Record<string, unknown>,
      resolver: ConnectionResolver,
   ): Promise<unknown> {
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
         await this.authorize({ plugin, query, params });
         const db = await resolver(pluginName);
         const queryHandler = plugin.newQueryHandler(query);
         return await queryHandler.run({ db, params });
      } catch (err) {
         error = err;
         throw err;
      } finally {
         this.dispatchEvent(
            new AuditLogEvent({
               plugin,
               query,
               name,
               params,
               durationMs: performance.now() - start,
               error,
               location: query.location,
            }),
         );
      }
   }
}
