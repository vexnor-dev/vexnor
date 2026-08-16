import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeConfig } from "vite";
import { sharedConfig } from "../../vitest.shared.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default mergeConfig(sharedConfig, {
   test: {},
   resolve: {
      alias: {
         "#src/charms": path.resolve(__dirname, "./src/charms"),
         "#src/crud": path.resolve(__dirname, "./src/crud"),
         "#src/default-query-options.js": path.resolve(
            __dirname,
            "./src/default-query-options.ts",
         ),
         "#src/pg-types.js": path.resolve(__dirname, "./src/pg-types.ts"),
         "#src/postgres-augment.js": path.resolve(
            __dirname,
            "./src/postgres-augment.ts",
         ),
         "#src/postgres-query-handler.js": path.resolve(
            __dirname,
            "./src/postgres-query-handler.ts",
         ),
         "#src/postgres-sql.js": path.resolve(
            __dirname,
            "./src/postgres-sql.ts",
         ),
         "#src/postgres-tokenizer.js": path.resolve(
            __dirname,
            "./src/postgres-tokenizer.ts",
         ),
         "#src/postgres-transaction.js": path.resolve(
            __dirname,
            "./src/postgres-transaction.ts",
         ),
         "#src/schema": path.resolve(__dirname, "./src/schema"),
         "#src/vexnor-postgres.js": path.resolve(
            __dirname,
            "./src/vexnor-postgres.ts",
         ),
      },
   },
});
