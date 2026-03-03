import { defineConfig } from "vite";
import path from "node:path";

// vitest.config.ts
export default defineConfig({
   test: {
      name: "test",
      setupFiles: ["./src/test-setup.ts"],
      globalSetup: ["./src/global-setup.ts"],
      env: {
         ENV_PATH: path.resolve("../../env-dev.json"),
      },
   },
});
