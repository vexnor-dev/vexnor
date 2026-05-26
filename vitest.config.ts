import { defineConfig } from "vitest/config";

export default defineConfig({
   test: {
      include: [],
      projects: [
         "./packages/vexnor",
         "./packages/vexnor-mssql",
         "./packages/vexnor-postgres",
         "./packages/vexnor-sqlite3",
         "./packages/vexnor-drizzle",
         "./packages/vexnor-typeorm",
         "./packages/vexnor-sequelize",
         "./packages/vexnor-prisma",
         "./tests/vexnor-test-mssql",
         "./tests/vexnor-test-postgres",
         "./tests/vexnor-test-sqlite3",
      ],
      typecheck: {
         enabled: true,
         checker: "tsc",
      },
      coverage: {
         provider: "v8",
         reportsDirectory: "./coverage",
         reporter: ["text", "html", "json", "json-summary", "clover"],
         include: ["**/src/**/*"],
         exclude: ["**/__tests__/**", "**/test/**"],
      },
   },
});
