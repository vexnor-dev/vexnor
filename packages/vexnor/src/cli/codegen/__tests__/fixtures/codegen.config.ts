import { defineConfig } from "../../../../config/define-config.js";

export default defineConfig({
   defaultProfile: "postgres",
   profiles: {
      postgres: {
         connection: { uri: "test://localhost" },
         generate: {
            plugin: "test-plugin",
            schema: ["public"],
            outDir: "./out",
            schemas: {
               public: {
                  tables: {
                     account: {
                        columns: {
                           metadata: {
                              json: { city: "string", score: "number" },
                           },
                        },
                     },
                  },
               },
            },
         },
      },
      analytics: {
         connection: { uri: "test://analytics" },
         generate: {
            plugin: "test-plugin",
            schema: ["analytics"],
            outDir: "./out/analytics",
         },
      },
   },
});
