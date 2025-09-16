import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
   plugins: [],
   resolve: {
      alias: {
         valnor: resolve(__dirname, "./src/core/index.ts"),
      },
   },
});
