import { loadConfig, loadQueryConfig, resolveProfile } from "../../config/index.js";
import { formatCsv, formatJson, formatTable } from "./formatters.js";
import { AsyncQueryHandler, AsyncQueryHandlerAny, SqlQuery } from "../../core/index.js";
import { detectQueryType } from "./detect-query-type.js";
import { confirmPrompt } from "./confirm-prompt.js";
import * as path from "node:path";
import { SqlExecError } from "./sql-exec-error.js";

export interface ExecOptions {
   config: string;
   queryConfig?: string;
   env?: string;
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
         case querySettings.query instanceof AsyncQueryHandler:
            return querySettings.query.query;
         default:
            throw new SqlExecError(`Unknown query type in config: ${querySettings.query}`);
      }
   })();

   const params =
      options.env && querySettings.environments?.[options.env]
         ? querySettings.environments[options.env]
         : querySettings.params;

   const format = options.format || querySettings.format || rootConfig.exec?.format || "json";
   const limit = options.limit ?? querySettings.limit ?? rootConfig.exec?.limit;

   const sql = query.getSql({ params });

   if (options.dryRun) {
      const values = query.getValues({ params });
      console.log("SQL:", sql);
      console.log("Values:", values);
      return;
   }

   if (!options.confirm) {
      const queryType = detectQueryType(sql);
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
      connection = await plugin.createConnection(profile.connection);
   } catch (err) {
      throw new Error(
         `Failed to connect using profile '${profileName}': ${err instanceof Error ? err.message : String(err)}`,
      );
   }

   try {
      let queryHandler: AsyncQueryHandlerAny | undefined;
      switch (true) {
         case query instanceof SqlQuery:
            queryHandler = plugin.newQueryHandler(query);
            break;
         case query instanceof AsyncQueryHandler:
            queryHandler = query;
            break;
         default:
            throw new Error(`Unknown query type: ${query}`);
      }

      let result: unknown[];
      try {
         result = (await queryHandler.getAll({ db: connection.db, params })) as unknown[];
      } catch (err) {
         const errorMsg = err instanceof Error ? err.message : String(err);
         throw new Error(
            `Query execution failed for '${queryName}':\n` +
               `SQL: ${sql}\n` +
               `Params: ${JSON.stringify(params)}\n` +
               `Error: ${errorMsg}`,
         );
      }

      if (limit !== undefined && limit > 0) {
         result = result.slice(0, limit);
      }

      console.log("SQL:", sql);
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
