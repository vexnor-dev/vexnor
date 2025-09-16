import { ValnorPlugin } from "./plugin/index.js";

export async function loadPlugin(packageName: string): Promise<ValnorPlugin> {
   const plugin = await import(packageName);
   if (!plugin.default) {
      throw new Error(`Plugin ${packageName} does not have a default export`);
   }

   if (!(plugin.default instanceof ValnorPlugin)) {
      throw new Error(`Plugin ${packageName} does not extend ValnorPlugin.`);
   }

   return plugin.default;
}
