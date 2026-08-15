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
         "#src/get-column-type.js": path.resolve(
            __dirname,
            "./src/get-column-type.ts",
         ),
         "#src/mssql-augment.js": path.resolve(
            __dirname,
            "./src/mssql-augment.ts",
         ),
         "#src/mssql-query-handler.js": path.resolve(
            __dirname,
            "./src/mssql-query-handler.ts",
         ),
         "#src/mssql-sql.js": path.resolve(
            __dirname,
            "./src/mssql-sql.ts",
         ),
         "#src/mssql-tokenizer.js": path.resolve(
            __dirname,
            "./src/mssql-tokenizer.ts",
         ),
         "#src/mssql-transaction.js": path.resolve(
            __dirname,
            "./src/mssql-transaction.ts",
         ),
         "#src/schema": path.resolve(__dirname, "./src/schema"),
         "#src/vexnor-mssql.js": path.resolve(
            __dirname,
            "./src/vexnor-mssql.ts",
         ),
      },
   },
});
