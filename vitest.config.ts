import { defineConfig } from "vitest/config";

export default defineConfig({
   test: {
      include: [],
      projects: [
         "./packages/valnor",
         "./packages/valnor-mssql",
         "./packages/valnor-postgres",
         "./packages/valnor-sqlite3",
         "./packages/valnor-drizzle",
         "./packages/valnor-typeorm",
         "./tests/valnor-test-mssql",
         "./tests/valnor-test-postgres",
         "./tests/valnor-test-sqlite3",
      ],
   },
});
