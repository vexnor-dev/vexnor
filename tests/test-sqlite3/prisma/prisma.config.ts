import { defineConfig } from "prisma/config";

const sqlitePath = process.env.SQLITE_PATH ?? process.env.VEXNOR_SQLITE_PATH ?? "./@db-sqlite3/vexnor-dev.sqlite";

export default defineConfig({
   schema: "./schema.prisma",
   migrations: {
      path: "./migrations",
   },
   datasource: {
      url: `file:${sqlitePath}`,
   },
});
