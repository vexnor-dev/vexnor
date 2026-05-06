import { pathToFileURL } from "url";
import { QueryConfig, QueryOrHandler } from "#/config/config-types.js";
import { access } from "fs/promises";
import { resolve } from "path";
import { register } from "tsx/esm/api";

// Register tsx loader once
register();

export async function loadQueryConfig(configPath: string): Promise<QueryConfig<Record<string, QueryOrHandler>>> {
   try {
      await access(configPath);
   } catch {
      throw new Error(`Query config file not found: ${configPath}`);
   }

   try {
      const resolvedPath = resolve(configPath);
      const module = await import(pathToFileURL(resolvedPath).href);
      const config = module.default;

      if (!config) {
         throw new Error(`No config exported from ${configPath}`);
      }

      return config;
   } catch (err) {
      if (err instanceof Error && err.message.includes("No config exported")) {
         throw err;
      }
      throw new Error(
         `Failed to load query config from ${configPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
   }
}
