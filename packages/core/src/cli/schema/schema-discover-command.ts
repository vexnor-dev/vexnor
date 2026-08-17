import path from "node:path";
import type { SchemaNamespace } from "#src/plugin/plugin.js";
import { loadConfig } from "#src/config/load-config.js";
import { discoverSchemaNamespaces } from "#src/schema/schema-namespace-discovery.js";
import { SchemaConfigurationError } from "#src/schema/schema-errors.js";

export type SchemaDiscoverCommandOptions = {
   config?: string;
   profile?: string;
};

type SchemaDiscoverCommandDependencies = {
   loadConfig: typeof loadConfig;
   discover: typeof discoverSchemaNamespaces;
   write(message: string): void;
};

const defaultDependencies: SchemaDiscoverCommandDependencies = {
   loadConfig,
   discover: discoverSchemaNamespaces,
   write: (message) => console.log(message),
};

export async function schemaDiscoverCommand(
   options: SchemaDiscoverCommandOptions,
   dependencies: SchemaDiscoverCommandDependencies = defaultDependencies,
): Promise<SchemaNamespace[] | undefined> {
   const configPath = path.resolve(options.config ?? "vexnor.config.ts");
   const config = await dependencies.loadConfig(configPath);
   const profileName = options.profile ?? config.defaultProfile;
   if (!profileName)
      throw new SchemaConfigurationError("No Vexnor profile was specified and the config has no defaultProfile");
   const profile = config.profiles[profileName];
   if (!profile) throw new SchemaConfigurationError(`Unknown Vexnor profile: ${profileName}`);
   if (!profile.plugin) throw new SchemaConfigurationError(`Vexnor profile '${profileName}' has no plugin`);

   dependencies.write(`Discovering schemas for profile '${profileName}'...`);
   const schemas = await dependencies.discover({ plugin: profile.plugin, connection: profile.connection });
   if (!schemas) {
      dependencies.write(`Plugin '${profile.plugin}' does not support schema discovery.`);
      return undefined;
   }

   dependencies.write(`Discovered ${schemas.length} schemas:`);
   for (const schema of schemas) {
      dependencies.write(`  [${schema.system ? "system" : "user"}] ${schema.name}`);
   }
   return schemas;
}
