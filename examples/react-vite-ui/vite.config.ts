import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
   plugins: [react(), tsconfigPaths({ projects: ["./tsconfig.json"] })],
   server: {
      port: 5173,
      proxy: {
         "/api": {
            target: "http://localhost:5000",
            changeOrigin: true,
         },
      },
   },
});
