import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
   root: "client",
   plugins: [react()],
   resolve: {
      alias: {
         "#shared": path.resolve("shared"),
         "#": path.resolve("client/src"),
      },
   },
   build: {
      outDir: "../dist/client",
      emptyOutDir: true,
      rolldownOptions: {
         external: ["@hono/node-server", "mssql", "pg"],
      },
   },
   server: {
      proxy: {
         "/api": "http://localhost:3001",
      },
   },
});
