import type { ConnectionConfig, SchemaNamespace } from "#src/plugin/plugin.js";
import { loadPlugin } from "#src/load-plugin.js";

export type { SchemaNamespace } from "#src/plugin/plugin.js";

export type DiscoverSchemaNamespacesArgs = {
   plugin: string;
   connection: ConnectionConfig;
};

export async function discoverSchemaNamespaces(
   args: DiscoverSchemaNamespacesArgs,
): Promise<SchemaNamespace[] | undefined> {
   const { plugin } = await loadPlugin(args.plugin);
   if (!plugin.discoverSchemas) return undefined;
   return plugin.discoverSchemas(args.connection);
}
