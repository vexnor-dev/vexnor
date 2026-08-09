import { mergeConfig } from "vite";
import { sharedConfig } from "../../vitest.shared.js";

export default mergeConfig(sharedConfig, {
   test: {
      globalSetup: ["./src/global-setup.ts"],
      fileParallelism: false,
   },
});
