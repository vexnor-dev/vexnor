import { VexnorPlugin } from "#/plugin/plugin.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { VexnorPluginAny } from "#/plugin/plugin.js";

const VALID_PACKAGE_NAME = /^@vexnor\/[a-z0-9-]+$/;

export async function loadPlugin(packageName: string): Promise<{ plugin: VexnorPluginAny; path: string }> {
   if (!VALID_PACKAGE_NAME.test(packageName)) {
      throw new Error(`Invalid plugin package name: ${packageName}`);
   }
   let plugin;
   let pluginPath: string;
   try {
      pluginPath = packageName;
      plugin = await import(packageName);
   } catch (error) {
      // Fallback for local workspace packages
      if (error && typeof error === "object" && "code" in error && error.code === "ERR_MODULE_NOT_FOUND") {
         const currentDir = dirname(fileURLToPath(import.meta.url));
         const folderName = packageName.replace("@vexnor/", "");
         pluginPath = resolve(currentDir, `../../../plugins/${folderName}/dist/index.js`);
         plugin = await import(pluginPath);
      } else {
         throw error;
      }
   }

   if (!plugin.default) {
      throw new Error(`Plugin ${packageName} does not have a default export`);
   }

   if (!(plugin.default instanceof VexnorPlugin)) {
      throw new Error(`Plugin ${packageName} does not extend VexnorPlugin.`);
   }

   return { plugin: plugin.default, path: pluginPath };
}
