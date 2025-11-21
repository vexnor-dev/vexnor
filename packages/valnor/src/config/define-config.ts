import { ValnorConfig } from "./config-types.js";

export function defineConfig<T extends ValnorConfig>(config: T): T {
   if (!config.profiles || Object.keys(config.profiles).length === 0) {
      throw new Error("Config must have at least one profile");
   }

   for (const [name, profile] of Object.entries(config.profiles)) {
      if (!profile.connection) {
         throw new Error(`Profile '${name}' missing connection`);
      }
      if (!profile.generate) {
         throw new Error(`Profile '${name}' missing generate config`);
      }
   }

   return config;
}
