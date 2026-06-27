import { defineConfig } from "../../define-config.js";

export default defineConfig({
   profiles: {
      postgres: {
         plugin: "test-plugin",
         connection: { uri: "test://localhost" },
         generate: { schema: ["public"], outDir: "./out" },
      },
   },
});
