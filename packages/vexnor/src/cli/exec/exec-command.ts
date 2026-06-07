import { loadConfig, loadQueryConfig, resolveProfile } from "#/config/config.js";
import { formatCsv, formatJson, formatTable } from "#/cli/exec/formatters.js";
import { SqlQueryHandler, SqlQueryHandlerAny } from "#/core/query/sql-query-handler.js";
import { SqlQuery } from "#/core/query/sql-query.js";
import { detectQueryType } from "#/cli/exec/detect-query-type.js";
import { confirmPrompt } from "#/cli/exec/confirm-prompt.js";
import { isContextValue } from "#/core/query/context-value.js";
import * as path from "node:path";
import { SqlExecError } from "#/cli/exec/sql-exec-error.js";

export interface ExecOptions {
   config: string;
   queryConfig?: string;
   env?: string;
   context?: string[];
   format?: "table" | "json" | "csv";
   limit?: number;
   dryRun?: boolean;
   confirm?: boolean;
}

export async function execCommand(queryName: string, options: ExecOptions): Promise<void> {
   const configPath = path.resolve(process.cwd(), options.config);
   const rootConfig = await loadConfig(configPath);

   if (!options.queryConfig) {
      throw new Error("--query-config is required");
   }

   const { glob } = await import("glob");
   const searchPattern = path.isAbsolute(options.queryConfig)
      ? options.queryConfig
      : path.join("**", options.queryConfig);
   const files = await glob(searchPattern, {
      cwd: process.cwd(),
      absolute: true,
      ignore: ["**/node_modules/**", "**/dist/**", "**/build/**"],
   });

   if (files.length === 0) {
      throw new Error(`No files found matching: ${options.queryConfig}`);
   }
   if (files.length > 1) {
      throw new Error(`Multiple files found matching '${options.queryConfig}': ${files.join(", ")}. Be more specific.`);
   }

   const queryConfigPath = files[0]!;

   const queryConfig = await loadQueryConfig(queryConfigPath!);
   const querySettings = queryConfig.queries[queryName];

   if (!querySettings) {
      throw new Error(`Query '${queryName}' not found in config`);
   }

   const profileName = resolveProfile(querySettings.profile, rootConfig);
   if (!profileName) {
      throw new Error(`Profile not found for query '${queryName}'`);
   }

   const profile = rootConfig.profiles[profileName];
   if (!profile) {
      throw new Error(`Profile '${profileName}' not found in config`);
   }

   // Plugin is now in query settings, not profile
   // The plugin import in query config file executes module augmentation
   const query = (() => {
      switch (true) {
         case querySettings.query instanceof SqlQuery:
            return querySettings.query;
         default:
            throw new SqlExecError(`Unknown query type in config: ${querySettings.query}`);
      }
   })();

   const params =
      options.env && querySettings.environments?.[options.env]
         ? querySettings.environments[options.env]
         : querySettings.params;

   // Parse --context key=value pairs and substitute contextValue sentinels
   const runtimeOverrides: Record<string, string> = {};
   for (const entry of options.context ?? []) {
      const eq = entry.indexOf("=");
      if (eq === -1) throw new Error(`Invalid --context value '${entry}': expected key=value`);
      runtimeOverrides[entry.slice(0, eq)] = entry.slice(eq + 1);
   }

   const resolvedParams: Record<string, unknown> = {};
   for (const [key, value] of Object.entries(params ?? {})) {
      if (isContextValue(value)) {
         if (!(key in runtimeOverrides)) {
            throw new Error(`Context param '${key}' has no value. Provide it with: --context ${key}=<value>`);
         }
         resolvedParams[key] = runtimeOverrides[key];
      } else {
         resolvedParams[key] = value;
      }
   }

   const format = options.format || querySettings.format || rootConfig.exec?.format || "json";
   const limit = options.limit ?? querySettings.limit ?? rootConfig.exec?.limit;

   const { text, values } = query.getSql({ params: resolvedParams });
   if (options.dryRun) {
      console.log("SQL:", text);
      console.log("Values:", values);
      return;
   }

   if (options.confirm !== true) {
      const queryType = detectQueryType(text);
      const confirmMutations = rootConfig.exec?.confirmMutations ?? false;
      const confirmDestructive = rootConfig.exec?.confirmDestructive ?? true;

      if (queryType === "destructive" && confirmDestructive) {
         const confirmed = await confirmPrompt("⚠️  DESTRUCTIVE operation! Are you sure?", true);
         if (!confirmed) {
            console.log("Operation cancelled");
            return;
         }
      } else if (queryType === "mutation" && confirmMutations) {
         const confirmed = await confirmPrompt("Execute mutation query?", false);
         if (!confirmed) {
            console.log("Operation cancelled");
            return;
         }
      }
   }

   // Get plugin instance from query settings
   const plugin = querySettings.plugin;
   if (!plugin || typeof plugin.createConnection !== "function" || typeof plugin.driver !== "string") {
      throw new Error(`Query '${queryName}' missing valid plugin reference`);
   }

   let connection;
   try {
      connection = await plugin.createConnection({ config: profile.connection });
   } catch (err) {
      throw new Error(
         `Failed to connect using profile '${profileName}': ${err instanceof Error ? err.message : String(err)}`,
      );
   }

   try {
      let queryHandler: SqlQueryHandlerAny | undefined;
      switch (true) {
         case query instanceof SqlQuery:
            queryHandler = plugin.newQueryHandler(query);
            break;
         case query instanceof SqlQueryHandler:
            queryHandler = query;
            break;
         default:
            throw new Error(`Unknown query type: ${query}`);
      }

      let result: unknown[];
      try {
         result = (await queryHandler.all({ db: connection.db, params: resolvedParams })) as unknown[];
      } catch (err) {
         const errorMsg = err instanceof Error ? err.message : String(err);
         throw new Error(
            `Query execution failed for '${queryName}':\n` +
               `SQL: ${text}\n` +
               `Params: ${JSON.stringify(resolvedParams)}\n` +
               `Error: ${errorMsg}`,
         );
      }

      if (limit !== undefined && limit > 0) {
         result = result.slice(0, limit);
      }

      console.log("SQL:", text);
      console.log();

      let output: string;
      switch (format) {
         case "table":
            output = formatTable(result);
            break;
         case "csv":
            output = formatCsv(result);
            break;
         case "json":
         default:
            output = formatJson(result);
            break;
      }

      console.log("Results:");
      console.log(output);
   } finally {
      await connection.close();
   }
}
