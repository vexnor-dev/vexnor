import { pathToFileURL } from "url";
import { QueryConfig } from "./types.js";
import { SqlQueryAny } from "../core/index.js";
import { access } from "fs/promises";

export async function loadQueryConfig(configPath: string): Promise<QueryConfig<Record<string, SqlQueryAny>>> {
   try {
      await access(configPath);
   } catch {
      throw new Error(`Query config file not found: ${configPath}`);
   }

   try {
      let module: any;
      if (configPath.endsWith('.ts')) {
         const { createServer } = await import('vite');
         const vite = await createServer({ clearScreen: false, logLevel: 'error' });
         module = await vite.ssrLoadModule(configPath);
         await vite.close();
      } else {
         const fileUrl = pathToFileURL(configPath).href;
         module = await import(fileUrl);
      }
      
      const config = module.default;

      if (!config) {
         throw new Error(`No config exported from ${configPath}`);
      }

      return config;
   } catch (err) {
      if (err instanceof Error && err.message.includes("No config exported")) {
         throw err;
      }
      throw new Error(`Failed to load query config from ${configPath}: ${err instanceof Error ? err.message : String(err)}`);
   }
}
