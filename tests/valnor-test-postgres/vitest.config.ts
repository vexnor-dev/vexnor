import { mergeConfig } from "vite";
import { sharedConfig } from "../../vitest.shared.js";

export default mergeConfig(sharedConfig, {
   test: {
      name: "valnor-test-postgres",
      setupFiles: ["./src/test-setup.ts"],
      globalSetup: ["./src/global-setup.ts"],
   },
});
