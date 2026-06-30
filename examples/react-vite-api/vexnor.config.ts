import { defineConfig } from "@vexnor/core/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
   profiles: {
      sqlite3: {
         plugin: "@vexnor/sqlite3",
         connection: {
            uri: path.resolve(__dirname, process.env.SQLITE_PATH ?? "../../@db-sqlite3/vexnor-dev.sqlite"),
         },
         generate: {
            schema: ["main"],
            outDir: "shared/codegen/sqlite3",
            pascalCaseTables: true,
            camelCaseColumns: true,
         },
      },
      postgres: {
         plugin: "@vexnor/postgres",
         connection: {
            host: process.env.POSTGRES_HOST ?? "localhost",
            port: Number(process.env.POSTGRES_PORT ?? 5432),
            user: process.env.POSTGRES_USER ?? "postgres",
            password: process.env.POSTGRES_PASSWORD ?? "postgres",
            database: process.env.POSTGRES_DATABASE ?? "postgres",
         },
         generate: {
            schema: ["vexnor_dev"],
            outDir: "shared/codegen/postgres",
            pascalCaseTables: true,
            camelCaseColumns: true,
         },
      },
      mssql: {
         plugin: "@vexnor/mssql",
         connection: {
            host: process.env.MSSQL_HOST ?? "localhost",
            port: Number(process.env.MSSQL_PORT ?? 1433),
            database: process.env.MSSQL_DATABASE ?? "vexnor",
            user: process.env.MSSQL_USER ?? "vexnor_dev",
            password: process.env.MSSQL_PASSWORD ?? "P@ssw0rd!",
         },
         generate: {
            schema: ["vexnor_dev"],
            outDir: "shared/codegen/mssql",
            pascalCaseTables: true,
            camelCaseColumns: true,
         },
      },
   },
   defaultProfile: "sqlite3",
   exec: {
      format: "table",
      confirmMutations: true,
      confirmDestructive: true,
   },
});
