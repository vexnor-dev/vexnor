import path from "node:path";
import { loadPlugin } from "#src/load-plugin.js";
import { loadConfig } from "#src/config/load-config.js";
import { createSchemaCatalog } from "#src/schema/schema-catalog.js";
import { loadLocalSelection, resolveLocalSelectionPath } from "#src/schema/local-selection-store.js";
import { reconcileSchemaSelection } from "#src/schema/schema-selection.js";
import { SchemaConfigurationError } from "#src/schema/schema-errors.js";
import { createLocalDataSession } from "#src/schema/local-data-session.js";
import { startLocalDataMcpServer, type LocalDataMcpRun, type LocalDataMcpTool } from "#src/schema/local-data-mcp.js";
import { logger } from "#src/logger.js";

export type SchemaMcpCommandOptions = {
   config?: string;
   profile?: string;
   selectionConfig?: string;
   tools: LocalDataMcpTool[];
   maxRows?: number;
   timeoutMs?: number;
   maxConcurrency?: number;
};

type SchemaMcpCommandDependencies = {
   loadConfig: typeof loadConfig;
   loadPlugin: typeof loadPlugin;
   loadSelection: typeof loadLocalSelection;
   startMcp: typeof startLocalDataMcpServer;
   onSignal(handler: () => void): () => void;
};

const defaultDependencies: SchemaMcpCommandDependencies = {
   loadConfig,
   loadPlugin,
   loadSelection: loadLocalSelection,
   startMcp: startLocalDataMcpServer,
   onSignal: (handler) => {
      process.once("SIGINT", handler);
      process.once("SIGTERM", handler);
      return () => {
         process.off("SIGINT", handler);
         process.off("SIGTERM", handler);
      };
   },
};

export async function schemaMcpCommand(
   options: SchemaMcpCommandOptions,
   dependencies: SchemaMcpCommandDependencies = defaultDependencies,
): Promise<void> {
   const controller = new AbortController();
   const removeSignalHandlers = dependencies.onSignal(() => controller.abort());
   const previousLogLevel = logger.level;
   logger.level = "silent";
   let run: LocalDataMcpRun | undefined;

   try {
      const configPath = path.resolve(options.config ?? "vexnor.config.ts");
      const config = await dependencies.loadConfig(configPath);
      const profileName = options.profile ?? config.defaultProfile;
      if (!profileName)
         throw new SchemaConfigurationError("No Vexnor profile was specified and the config has no defaultProfile");
      const profile = config.profiles[profileName];
      if (!profile) throw new SchemaConfigurationError(`Unknown Vexnor profile: ${profileName}`);
      if (!profile.plugin) throw new SchemaConfigurationError(`Vexnor profile '${profileName}' has no plugin`);
      if (!profile.generate)
         throw new SchemaConfigurationError(`Vexnor profile '${profileName}' has no generate config`);
      if (profile.generate.schema.length === 0)
         throw new SchemaConfigurationError(`Vexnor profile '${profileName}' has no schemas to inspect`);

      const { plugin } = await dependencies.loadPlugin(profile.plugin);
      const schema = await plugin.getSchema({ ...profile.connection, schemas: profile.generate.schema });
      const catalog = createSchemaCatalog({
         plugin,
         schema,
         naming: { camelCaseColumns: profile.generate.camelCaseColumns },
      });
      const selectionPath = resolveLocalSelectionPath(configPath, options.selectionConfig);
      const selectionDocument = await dependencies.loadSelection(selectionPath);
      const storedSelection = selectionDocument.profiles[profileName];
      if (!storedSelection) {
         throw new SchemaConfigurationError(
            `No persisted schema selection exists for profile '${profileName}'. Run 'vexnor schema select --profile ${profileName}' first.`,
         );
      }
      const selection = reconcileSchemaSelection({ catalog, selection: storedSelection });
      const connection = await plugin.createConnection({ config: profile.connection });
      const session = await createLocalDataSession({
         plugin,
         connection,
         catalog,
         selection: selection.scope,
         limits: {
            maxRows: options.maxRows ?? 100,
            timeoutMs: options.timeoutMs ?? 30_000,
            maxConcurrency: options.maxConcurrency ?? 1,
         },
         signal: controller.signal,
      });

      try {
         run = await dependencies.startMcp({
            session,
            enabledTools: options.tools,
            signal: controller.signal,
         });
         await run.closed;
      } finally {
         await run?.close();
         await session.close();
      }
   } finally {
      removeSignalHandlers();
      logger.level = previousLogLevel;
   }
}
