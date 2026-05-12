import { defineConfig } from "prisma/config";

export default defineConfig({
   schema: "./schema.prisma",
   migrations: {
      path: "./migrations",
   },
   datasource: {
      url: `postgresql://postgres:postgres@localhost:5432/postgres`,
   },
});
