import { defineConfig } from "../../../../config/index.js";

export default defineConfig({
   profiles: {
      testdb: {
         plugin: "test-plugin",
         connection: { uri: "test://localhost" },
         generate: { schema: ["public"], outDir: "./out" },
      },
   },
});
