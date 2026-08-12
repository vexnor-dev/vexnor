import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeConfig } from "vite";
import { sharedConfig } from "../../vitest.shared.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default mergeConfig(sharedConfig, {
   resolve: {
      alias: {
         "#src/charms": path.resolve(__dirname, "./src/charms"),
         "#src/crud": path.resolve(__dirname, "./src/crud"),
         "#src/default-query-options.js": path.resolve(__dirname, "./src/default-query-options.ts"),
         "#src/duckdb-augment.js": path.resolve(__dirname, "./src/duckdb-augment.ts"),
         "#src/duckdb-connection-config.js": path.resolve(__dirname, "./src/duckdb-connection-config.ts"),
         "#src/duckdb-query-handler.js": path.resolve(__dirname, "./src/duckdb-query-handler.ts"),
         "#src/duckdb-sql.js": path.resolve(__dirname, "./src/duckdb-sql.ts"),
         "#src/duckdb-tokenizer.js": path.resolve(__dirname, "./src/duckdb-tokenizer.ts"),
         "#src/duckdb-transaction.js": path.resolve(__dirname, "./src/duckdb-transaction.ts"),
         "#src/duckdb-values.js": path.resolve(__dirname, "./src/duckdb-values.ts"),
         "#src/schema": path.resolve(__dirname, "./src/schema"),
         "#src/vexnor-duckdb.js": path.resolve(__dirname, "./src/vexnor-duckdb.ts"),
      },
   },
});
