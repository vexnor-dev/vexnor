import tsconfigPaths from "vite-tsconfig-paths";
import { mergeConfig } from "vite";
import { sharedConfig } from "../../vitest.shared.js";

export default mergeConfig(sharedConfig, {
   plugins: [tsconfigPaths()],
   test: {},
});
