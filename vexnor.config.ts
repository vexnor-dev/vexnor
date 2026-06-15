import { defineConfig } from "vexnor/config";
import { GetEnvVars } from "env-cmd";
import { ok } from "node:assert";

const postgresEnv = await GetEnvVars({
   rc: {
      environments: ["postgres"],
      filePath: "../../env-dev.json",
   },
   verbose: true,
});

Object.assign(process.env, postgresEnv);
ok(process.env.POSTGRES_HOST, "POSTGRES_HOST is required");
ok(process.env.POSTGRES_PORT, "POSTGRES_HOST is required");
ok(process.env.POSTGRES_USER, "POSTGRES_USER is required");
ok(process.env.POSTGRES_PASSWORD, "POSTGRES_PASSWORD is required");
ok(process.env.POSTGRES_DATABASE, "POSTGRES_DATABASE is required");

const mssqlEnv = await GetEnvVars({
   rc: {
      environments: ["mssql"],
      filePath: "../../env-dev.json",
   },
   verbose: true,
});

Object.assign(process.env, mssqlEnv);
ok(process.env.MSSQL_HOST, "MSSQL_HOST is required");
ok(process.env.MSSQL_PORT, "MSSQL_PORT is required");
ok(process.env.MSSQL_USER, "MSSQL_USER is required");
ok(process.env.MSSQL_PASSWORD, "MSSQL_PASSWORD is required");
ok(process.env.MSSQL_DATABASE, "MSSQL_DATABASE is required");

export default defineConfig({
   defaultProfile: "default",
   profiles: {
      postgres: {
         connection: {
            host: process.env.POSTGRES_HOST,
            port: +process.env.POSTGRES_PORT,
            user: process.env.POSTGRES_USER,
            password: process.env.POSTGRES_PASSWORD,
            database: process.env.POSTGRES_DATABASE,
         },
         generate: {
            plugin: "@vexnor/postgres",
            schema: [],
            outDir: "",
         },
      },
      mssql: {
         connection: {
            host: process.env.MSSQL_HOST,
            port: +process.env.MSSQL_PORT,
            user: process.env.MSSQL_USER,
            password: process.env.MSSQL_PASSWORD,
            database: process.env.MSSQL_DATABASE,
         },
         generate: {
            plugin: "@vexnor/mssql",
            schema: [],
            outDir: "",
         },
      },
      default: {
         connection: {
            host: process.env.POSTGRES_HOST,
            port: +process.env.POSTGRES_PORT,
            user: process.env.POSTGRES_USER,
            password: process.env.POSTGRES_PASSWORD,
            database: process.env.POSTGRES_DATABASE,
         },
         generate: {
            plugin: "@vexnor/postgres",
            schema: [],
            outDir: "",
         },
      },
   },
});
