import { mergeConfig } from "vite";
import { sharedConfig } from "../../vitest.shared.js";

export default mergeConfig(sharedConfig, {
   test: {
      name: "test-duckdb",
      setupFiles: ["./src/test-setup.ts"],
      globalSetup: ["./src/global-setup.ts"],
      fileParallelism: false,
      coverage: {
         exclude: ["src/create-test-database.ts"],
      },
   },
});
