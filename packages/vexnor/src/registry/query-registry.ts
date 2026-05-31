import { ok } from "#/lib/assert.js";
import type { SqlQueryAny } from "#/core/query/sql-query.js";
import type { VexnorPluginAny } from "#/plugin/vexnor-plugin.js";
import { SqlRunError } from "#/core/sql-run-error.js";
import { SqlExecError } from "#/cli/exec/sql-exec-error.js";

export type ConnectionResolver = (pluginName: string) => Promise<unknown>;
export type AuthorizeHook = (args: {
   plugin: VexnorPluginAny;
   query: SqlQueryAny;
   params: Record<string, unknown>;
}) => void | Promise<void>;

export class QueryRegistry {
   private readonly maps = new Map<string, Map<string, SqlQueryAny>>();
   private readonly plugins = new Map<string, VexnorPluginAny>();
   private readonly _authorizeHooks: AuthorizeHook[] = [];

   /**
    * Registers a hook called before every authorized query execution.
    *
    * The hook receives the query's `authorization` tag. Throw inside the hook
    * to deny execution.
    */
   registerAuthorization(hook: AuthorizeHook): void {
      this._authorizeHooks.push(hook);
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
      return Array.from(this.maps.values()).flatMap((map) => Array.from(map.values()));
   }

   async register(plugin: VexnorPluginAny, ...queries: SqlQueryAny[]): Promise<void> {
      if (!this.plugins.has(plugin.name)) {
         this.plugins.set(plugin.name, plugin);
      }
      if (!this.maps.has(plugin.name)) {
         this.maps.set(plugin.name, new Map());
      }
      const map = this.maps.get(plugin.name)!;
      for (const query of queries) {
         map.set(await query.hash, query);
      }
   }

   async execute(
      pluginName: string,
      hash: string,
      params: Record<string, unknown>,
      resolver: ConnectionResolver,
   ): Promise<unknown> {
      const query = this.maps.get(pluginName)?.get(hash);
      if (!query) {
         throw new SqlExecError(`Unknown query hash: ${hash} for plugin: ${pluginName}`);
      }

      const plugin = this.plugins.get(pluginName);
      ok(plugin, `Unknown plugin: ${pluginName}`);

      if (query.authorization) {
         if (!this._authorizeHooks.length) {
            throw new SqlRunError(
               `Query requires authorization (tag: "${query.authorization}") but no authorize hook is registered`,
               query,
               {},
            );
         }

         for (const hook of this._authorizeHooks) {
            await hook({ plugin, query, params });
         }
      }

      const db = await resolver(pluginName);
      const queryHandler = plugin.newQueryHandler(query);
      return queryHandler.run({ db, params });
   }
}
