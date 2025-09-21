import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
   plugins: [],
   resolve: {
      alias: {
         valnor: resolve(__dirname, "./src/core/index.ts"),
      },
   },
});
