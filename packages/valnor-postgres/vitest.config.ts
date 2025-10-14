// packages/valnor-postgres/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
   test: {
      setupFiles: ["./src/__tests__/setup-test.ts"],
   },
});
