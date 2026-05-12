import { defineConfig } from "prisma/config";

const host = process.env.POSTGRES_HOST ?? "localhost";
const port = process.env.POSTGRES_PORT ?? "5432";
const database = process.env.POSTGRES_DATABASE ?? "postgres";
const user = process.env.POSTGRES_USER ?? "postgres";
const password = process.env.POSTGRES_PASSWORD ?? "postgres";

export default defineConfig({
   schema: "./schema.prisma",
   migrations: {
      path: "./migrations",
   },
   datasource: {
      url: `postgresql://${user}:${password}@${host}:${port}/${database}`,
   },
});
