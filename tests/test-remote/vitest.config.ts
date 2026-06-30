import { mergeConfig } from "vite";
import { sharedConfig } from "../../vitest.shared.js";

export default mergeConfig(sharedConfig, {
   test: {
      name: "test-remote",
      fileParallelism: false,
      testTimeout: 15000,
   },
});
