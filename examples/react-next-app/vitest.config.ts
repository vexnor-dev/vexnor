import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
   plugins: [react()],
   test: {
      environment: "jsdom",
      globals: true,
      alias: {
         "#": path.resolve(__dirname, "client/src"),
         "#shared": path.resolve(__dirname, "shared"),
      },
   },
});
