import { ok } from "#/lib/assert.js";
import type { SqlQueryAny } from "#/core/query/sql-query.js";
import type { VexnorPluginAny } from "#/plugin/vexnor-plugin.js";

export type ConnectionResolver = (pluginName: string) => Promise<unknown>;

export class QueryRegistry {
   private readonly maps = new Map<string, Map<string, SqlQueryAny>>();
   private readonly plugins = new Map<string, VexnorPluginAny>();

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
      if (!query) throw new Error(`Unknown query hash: ${hash} for plugin: ${pluginName}`);

      const plugin = this.plugins.get(pluginName);
      ok(plugin, `Unknown plugin: ${pluginName}`);

      const db = await resolver(pluginName);
      const queryHandler = plugin.newQueryHandler(query);
      return queryHandler.run({ db, params });
   }
}
