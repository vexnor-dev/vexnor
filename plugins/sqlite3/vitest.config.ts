import path from "node:path";
import { fileURLToPath } from "node:url";

import { mergeConfig } from "vite";

import { sharedConfig } from "../../vitest.shared.js";
import { packageInternalSourceImports } from "../../vitest/package-internal-source-imports.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default mergeConfig(sharedConfig, {
   plugins: [packageInternalSourceImports(path.resolve(__dirname, "./src"))],
   test: {},
});
