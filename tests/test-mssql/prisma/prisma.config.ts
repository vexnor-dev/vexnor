import { defineConfig } from "prisma/config";

const host = process.env.MSSQL_HOST ?? "localhost";
const port = process.env.MSSQL_PORT ?? "1433";
const database = process.env.MSSQL_DATABASE ?? "vexnor";
const user = process.env.MSSQL_USER ?? "vexnor_dev";
const password = process.env.MSSQL_PASSWORD ?? "P@ssw0rd!";

export default defineConfig({
   schema: "./schema.prisma",
   migrations: {
      path: "./migrations",
   },
   datasource: {
      url: `sqlserver://${host}:${port};database=${database};user=${user};password=${password};trustServerCertificate=true`,
   },
});
