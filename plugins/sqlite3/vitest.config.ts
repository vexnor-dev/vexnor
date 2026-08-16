import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeConfig } from "vite";
import { sharedConfig } from "../../vitest.shared.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default mergeConfig(sharedConfig, {
   test: {},
   resolve: {
      alias: {
         "#src/better-sqlite3-query-handler.js": path.resolve(
            __dirname,
            "./src/better-sqlite3-query-handler.ts",
         ),
         "#src/charms": path.resolve(__dirname, "./src/charms"),
         "#src/crud": path.resolve(__dirname, "./src/crud"),
         "#src/schema": path.resolve(__dirname, "./src/schema"),
         "#src/sqlite3-augment.js": path.resolve(
            __dirname,
            "./src/sqlite3-augment.ts",
         ),
         "#src/sqlite3-formatter.js": path.resolve(
            __dirname,
            "./src/sqlite3-formatter.ts",
         ),
         "#src/sqlite3-sql.js": path.resolve(
            __dirname,
            "./src/sqlite3-sql.ts",
         ),
         "#src/sqlite3-tokenizer.js": path.resolve(
            __dirname,
            "./src/sqlite3-tokenizer.ts",
         ),
         "#src/sqlite3-transaction.js": path.resolve(
            __dirname,
            "./src/sqlite3-transaction.ts",
         ),
         "#src/vexnor-sqlite3.js": path.resolve(
            __dirname,
            "./src/vexnor-sqlite3.ts",
         ),
      },
   },
});
