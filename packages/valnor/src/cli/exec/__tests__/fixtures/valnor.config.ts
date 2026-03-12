import { defineConfig } from "../../../../config/config.js";

export default defineConfig({
   profiles: {
      testdb: {
         plugin: "test-plugin",
         connection: { uri: "test://localhost" },
         generate: { schema: ["public"], outDir: "./out" },
      },
   },
});
