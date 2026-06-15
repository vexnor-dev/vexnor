import path from "node:path";
import { fileURLToPath } from "url";
import { mergeConfig } from "vite";
import { sharedConfig } from "../../vitest.shared.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default mergeConfig(sharedConfig, {
   resolve: {
      alias: {
         "#": path.resolve(__dirname, "./src"),
      },
   },
   test: {},
});
