import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
   plugins: [tsconfigPaths()],
   test: {
      typecheck: {
         enabled: true,
         checker: "tsc",
      },
      setupFiles: ["./src/testing/vitest-query-equal.ts"],
      coverage: {
         provider: "v8",
         reportsDirectory: "./coverage",
         reporter: ["text", "html", "json"],
         include: ["src/**/*"],
         exclude: ["**/__tests__/**", "**/test/**"],
      },
   },
});
