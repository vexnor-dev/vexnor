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
         "./tests/vexnor-test-mssql",
         "./tests/vexnor-test-postgres",
         "./tests/vexnor-test-sqlite3",
      ],
   },
});
