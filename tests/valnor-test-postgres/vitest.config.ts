import { defineConfig } from "vite";

// vitest.config.ts
export default defineConfig({
   test: {
      setupFiles: ["./src/test-setup.ts"],
      globalSetup: ["./src/global-setup.ts"],
   },
});
