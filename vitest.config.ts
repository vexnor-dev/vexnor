import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
   test: {
      name: "root",
      projects: ["packages/*", "tests/*"],
      globals: true,
      environment: "node",
      testTimeout: 60_000,
      env: {
         ENV_PATH: path.resolve("./env-dev.json"),
      },
      coverage: {
         provider: "v8", // or 'c8', 'istanbul'
         reporter: ["text", "json", "html"],
         reportsDirectory: "./coverage",
         include: ["src/**/*.{js,ts}"],
         exclude: ["src/**/*.test.{js,ts}", "src/**/*.spec.{js,ts}"],
         thresholds: {
            global: {
               branches: 80,
               functions: 80,
               lines: 80,
               statements: 80,
            },
         },
      },
   },
});
