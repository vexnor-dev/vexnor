import { defineConfig } from "vitest/config";

export default defineConfig({
   test: {
      fileParallelism: true,
      isolate: false,
      projects: ["./packages/*", "./tests/*", "./examples/*"],
      typecheck: {
         enabled: true,
         checker: "tsc",
      },
      coverage: {
         provider: "v8",
         reportsDirectory: "./coverage",
         reporter: ["text", "html", "json", "json-summary", "clover"],
         reportOnFailure: true,
         include: ["**/src/**/*"],
         exclude: [
            "**/__tests__/**",
            "**/test/**",
            "**/coverage/**",
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
            "examples/**",
         ],
      },
   },
});
