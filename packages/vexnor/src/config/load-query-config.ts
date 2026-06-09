import { pathToFileURL } from "url";
import { QueryConfig } from "#/config/config-types.js";
import { access } from "fs/promises";
import { resolve } from "path";
import { register } from "tsx/esm/api";
import { SqlQueryBaseAny } from "#/core/query/sql-query.js";

// Register tsx loader once
register();

export async function loadQueryConfig(configPath: string): Promise<QueryConfig<Record<string, SqlQueryBaseAny>>> {
   try {
      await access(configPath);
   } catch {
      throw new Error(`Query config file not found: ${configPath}`);
   }

   let module: { default?: unknown };
   try {
      const resolvedPath = resolve(configPath);
      module = await import(pathToFileURL(resolvedPath).href);
   } catch (err) {
      throw new Error(
         `Failed to load query config from ${configPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
   }

   if (!module.default) {
      throw new Error(`No config exported from ${configPath}`);
   }

   return module.default as QueryConfig<Record<string, SqlQueryBaseAny>>;
}
