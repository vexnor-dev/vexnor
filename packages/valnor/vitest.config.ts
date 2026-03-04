import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";
import { fileURLToPath } from "url";
import { mergeConfig } from "vite";
import { sharedConfig } from "../../vitest.shared.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tsconfig = path.resolve(__dirname, "tsconfig.json");
console.log("[valnor]: Using tsconfig:", tsconfig);

export default mergeConfig(sharedConfig, {
   plugins: [tsconfigPaths()],
   resolve: {
      alias: {
         "@test-models": path.resolve(__dirname, "./src/test/models"),
      },
   },
   test: {
      setupFiles: ["./src/test/setup-test.ts"],
   },
});
