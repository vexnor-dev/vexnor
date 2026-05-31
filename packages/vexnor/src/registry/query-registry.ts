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
   private _authorizeHook: AuthorizeHook | undefined;

   /**
    * Registers a hook that is called before every query execution.
    *
    * The hook receives the query's `authorization` tag (or `null` if the query was
    * not tagged with `.authorize()`). Throw inside the hook to deny execution.
    */
   authorize(hook: AuthorizeHook): void {
      this._authorizeHook = hook;
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
         if (!this._authorizeHook) {
            throw new SqlRunError(
               `Query requires authorization (tag: "${query.authorization}") but no authorize hook is registered`,
               query,
               {},
            );
         }

         await this._authorizeHook({ plugin, query, params });
      }

      const db = await resolver(pluginName);
      const queryHandler = plugin.newQueryHandler(query);
      return queryHandler.run({ db, params });
   }
}
