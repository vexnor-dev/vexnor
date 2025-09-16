import { ValnorPlugin } from "./plugin/index.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

export async function loadPlugin(packageName: string): Promise<ValnorPlugin> {
   let plugin;
   try {
      plugin = await import(packageName);
   } catch (error) {
      // Fallback for local workspace packages
      if (error && typeof error === "object" && "code" in error && error.code === "ERR_MODULE_NOT_FOUND") {
         const currentDir = dirname(fileURLToPath(import.meta.url));
         const localPath = resolve(currentDir, `../../${packageName}/dist/index.js`);
         plugin = await import(localPath);
      } else {
         throw error;
      }
   }

   if (!plugin.default) {
      throw new Error(`Plugin ${packageName} does not have a default export`);
   }

   if (!(plugin.default instanceof ValnorPlugin)) {
      throw new Error(`Plugin ${packageName} does not extend ValnorPlugin.`);
   }

   return plugin.default;
}
