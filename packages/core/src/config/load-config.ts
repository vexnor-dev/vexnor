import { pathToFileURL } from "url";
import { VexnorConfig } from "#src/config/config-types.js";
import { access } from "fs/promises";
import { register } from "tsx/esm/api";

register();

export async function loadConfig(configPath: string): Promise<VexnorConfig> {
   try {
      await access(configPath);
   } catch {
      throw new Error(`Config file not found: ${configPath}`);
   }

   try {
      let module: { default?: VexnorConfig; config?: VexnorConfig };
      const fileUrl = pathToFileURL(configPath).href;
      module = await import(fileUrl);

      const config = module.default || module.config;

      if (!config) {
         throw new Error(`No config exported from ${configPath}`);
      }

      return config;
   } catch (err) {
      if (err instanceof Error && err.message.includes("No config exported")) {
         throw err;
      }
      throw new Error(`Failed to load config from ${configPath}: ${err instanceof Error ? err.message : String(err)}`);
   }
}
