import { defineConfig } from "vitest/config";

export default defineConfig({
   test: {
      fileParallelism: true,
      isolate: false,
      projects: ["./vitest", "./packages/*", "./plugins/*", "./orms/*", "./tests/*"],
      typecheck: {
         enabled: true,
         checker: "tsc",
      },
      coverage: {
         provider: "v8",
         reportsDirectory: "./coverage",
         reporter: ["text", "html", "json", "json-summary", "clover"],
         reportOnFailure: true,
         thresholds: {
            statements: 97,
            branches: 92,
            functions: 98,
            lines: 98,
         },
         include: ["**/src/**/*"],
         exclude: [
            "**/__tests__/**",
            "**/test/**",
            "**/coverage/**",
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
            "**/src/index.ts",
            "**/src/index.browser.ts",
            "examples/**",
            "**/cli/**",
            "**/codegen/library/**",
            "packages/core/src/core/core.ts",
            "packages/core/src/core/core.browser.ts",
            "packages/core/src/core/query/sql-models.ts",
            "stacks/**",
            "tests/**",
            "orms/**",
         ],
      },
   },
});
