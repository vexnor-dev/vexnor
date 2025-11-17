import { defineConfig } from "valnor/config";
import { GetEnvVars } from "env-cmd";
import { ok } from "node:assert";

const envDevVars = await GetEnvVars({
   rc: {
      environments: ["postgres"],
      filePath: "../../env-dev.json",
   },
   verbose: true,
});

Object.assign(process.env, envDevVars);
ok(process.env.POSTGRES_HOST, "POSTGRES_HOST is required");
ok(process.env.POSTGRES_PORT, "POSTGRES_HOST is required");
ok(process.env.POSTGRES_USER, "POSTGRES_USER is required");
ok(process.env.POSTGRES_PASSWORD, "POSTGRES_PASSWORD is required");
ok(process.env.POSTGRES_DATABASE, "POSTGRES_DATABASE is required");

export default defineConfig({
   defaultProfile: "default",
   profiles: {
      default: {
         connection: {
            host: process.env.POSTGRES_HOST,
            port: +process.env.POSTGRES_PORT,
            user: process.env.POSTGRES_USER,
            password: process.env.POSTGRES_PASSWORD,
            database: process.env.POSTGRES_DATABASE,
         },
         generate: {
            plugin: "valnor-postgres",
            schema: [],
            outDir: "",
         },
      },
   },
});
