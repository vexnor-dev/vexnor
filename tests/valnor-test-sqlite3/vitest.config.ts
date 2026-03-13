import { mergeConfig } from "vite";
import { sharedConfig } from "../../vitest.shared.js";

export default mergeConfig(sharedConfig, {
   base: "../../vitest.shared.js",
   test: {
      name: "valnor-test-sqlite3",
      globalSetup: ["./src/global-setup.ts"],
      fileParallelism: false,
   },
});
