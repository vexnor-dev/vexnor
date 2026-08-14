import path from "node:path";
import { loadPlugin } from "#src/load-plugin.js";
import { loadConfig } from "#src/config/load-config.js";
import { createSchemaCatalog } from "#src/schema/schema-catalog.js";
import {
   selectSchemaObjects,
   type SchemaSelectionRequest,
   type SchemaSelectionResult,
} from "#src/schema/schema-selection.js";
import { SchemaConfigurationError } from "#src/schema/schema-errors.js";
import { reviewSchemaSelectionInTerminal } from "#src/cli/schema/terminal-schema-review.js";

export type SchemaSelectCommandOptions = {
   config?: string;
   profile?: string;
   selectionConfig?: string;
   include?: string[];
   exclude?: string[];
   all?: boolean;
   save?: boolean;
};

type SchemaSelectCommandDependencies = {
   loadConfig: typeof loadConfig;
   loadPlugin: typeof loadPlugin;
   review: typeof reviewSchemaSelectionInTerminal;
   write(message: string): void;
};

const defaultDependencies: SchemaSelectCommandDependencies = {
   loadConfig,
   loadPlugin,
   review: reviewSchemaSelectionInTerminal,
   write: (message) => console.log(message),
};

export async function schemaSelectCommand(
   options: SchemaSelectCommandOptions,
   dependencies: SchemaSelectCommandDependencies = defaultDependencies,
): Promise<SchemaSelectionResult & { selectionConfigPath: string }> {
   const configPath = path.resolve(options.config ?? "vexnor.config.ts");
   const config = await dependencies.loadConfig(configPath);
   const profileName = options.profile ?? config.defaultProfile;
   if (!profileName) throw new SchemaConfigurationError("No Vexnor profile was specified and the config has no defaultProfile");
   const profile = config.profiles[profileName];
   if (!profile) throw new SchemaConfigurationError(`Unknown Vexnor profile: ${profileName}`);
   if (!profile.plugin) throw new SchemaConfigurationError(`Vexnor profile '${profileName}' has no plugin`);
   if (!profile.generate) throw new SchemaConfigurationError(`Vexnor profile '${profileName}' has no generate config`);
   if (profile.generate.schema.length === 0) throw new SchemaConfigurationError(`Vexnor profile '${profileName}' has no schemas to inspect`);

   dependencies.write(
      `Inspecting ${profile.generate.schema.length} ${profile.generate.schema.length === 1 ? "schema" : "schemas"} for profile '${profileName}'...`,
   );
   const { plugin } = await dependencies.loadPlugin(profile.plugin);
   const schema = await plugin.getSchema({ ...profile.connection, schemas: profile.generate.schema });
   const catalog = createSchemaCatalog({
      plugin,
      schema,
      naming: { camelCaseColumns: profile.generate.camelCaseColumns },
   });
   dependencies.write(`Discovered ${catalog.objects.length} schema objects:`);
   for (const object of catalog.objects) {
      dependencies.write(
         `  [${object.kind}] ${object.id} (${object.columns.length} ${object.columns.length === 1 ? "column" : "columns"})`,
      );
   }
   const nonInteractive = options.all === true || options.include !== undefined || options.exclude !== undefined;
   const request: SchemaSelectionRequest = nonInteractive
      ? {
           mode: "non-interactive",
           all: options.all,
           include: options.include,
           exclude: options.exclude,
           save: options.save,
        }
      : { mode: "interactive", review: (review) => dependencies.review(review) };
   const result = await selectSchemaObjects({
      catalog,
      request,
      profile: profileName,
      configPath,
      selectionConfigPath: options.selectionConfig,
   });

   dependencies.write(`Selected ${result.selectedObjects.length} of ${catalog.objects.length} schema objects for profile '${profileName}'.`);
   dependencies.write(`Selection config: ${result.selectionConfigPath}`);
   return result;
}
