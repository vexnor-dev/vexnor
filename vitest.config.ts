import { defineConfig } from "vitest/config";

export default defineConfig({
   test: {
      include: [],
      projects: [
         "./packages/valnor",
         "./packages/valnor-postgres",
         "./packages/valnor-mssql",
         "./packages/valnor-sqlite3",
         "./tests/valnor-test-mssql",
         // "./tests/valnor-test-postgres",
         // "./tests/valnor-test-sqlite3",
      ],
   },
});
