import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import path from "node:path";
import pg from "pg";
import mssql from "mssql";
import BetterSqlite3 from "better-sqlite3";
import { trace } from "@opentelemetry/api";
import "vexnor/telemetry";
import * as postgresQueries from "../../shared/queries/postgres.js";
import * as mssqlQueries from "../../shared/queries/mssql.js";
import * as sqlite3Queries from "../../shared/queries/sqlite3.js";
import vexnorMssql from "vexnor-mssql";
import vexnorPostgres from "vexnor-postgres";
import vexnorSqlite3 from "vexnor-sqlite3";
import { QueryRegistry } from "vexnor/registry";

const tracer = trace.getTracer("vexnor-react-vite-api");

type RequestContext = { token: string | null };
const queryRegistry = new QueryRegistry<RequestContext>();

const pgPool = new pg.Pool({
   host: process.env.POSTGRES_HOST ?? "localhost",
   port: Number(process.env.POSTGRES_PORT ?? 5432),
   user: process.env.POSTGRES_USER ?? "postgres",
   password: process.env.POSTGRES_PASSWORD ?? "postgres",
   database: process.env.POSTGRES_DATABASE ?? "postgres",
});

const mssqlPool = await mssql.connect({
   server: process.env.MSSQL_HOST ?? "localhost",
   port: Number(process.env.MSSQL_PORT ?? 1433),
   database: process.env.MSSQL_DATABASE ?? "vexnor",
   user: process.env.MSSQL_USER ?? "vexnor_dev",
   password: process.env.MSSQL_PASSWORD ?? "P@ssw0rd!",
   options: { trustServerCertificate: true },
});
const sqliteDb = new BetterSqlite3(
   path.resolve(process.cwd(), process.env.SQLITE_PATH ?? "../../@db-sqlite3/vexnor-dev.sqlite"),
);

await queryRegistry.register(vexnorPostgres, postgresQueries);
await queryRegistry.register(vexnorMssql, mssqlQueries);
await queryRegistry.register(vexnorSqlite3, sqlite3Queries);

queryRegistry.registerOpenTelemetry(tracer);

const app = new Hono();

app.use("*", logger());
app.use("/api/*", cors());

app.get("/api/health", async (c) => {
   const checks: Record<string, string> = {};

   try {
      await pgPool.query("SELECT 1");
      checks.postgres = "ok";
   } catch (err) {
      checks.postgres = err instanceof Error ? err.message : String(err);
   }

   try {
      await mssqlPool.request().query("SELECT 1");
      checks.mssql = "ok";
   } catch (err) {
      checks.mssql = err instanceof Error ? err.message : String(err);
   }

   try {
      sqliteDb.prepare("SELECT 1").get();
      checks.sqlite3 = "ok";
   } catch (err) {
      checks.sqlite3 = err instanceof Error ? err.message : String(err);
   }

   const allOk = Object.values(checks).every((v) => v === "ok");
   return c.json({ status: allOk ? "ok" : "degraded", databases: checks }, allOk ? 200 : 503);
});

app.post("/api/db", async (c) => {
   const { plugin, hash, params } = await c.req.json<{
      plugin: string;
      hash: string;
      params: Record<string, unknown>;
   }>();
   const token = c.req.header("Authorization")?.replace("Bearer ", "") ?? null;
   try {
      const result = await queryRegistry.execute(
         plugin,
         hash,
         params ?? {},
         async (p: string) => {
            switch (plugin) {
               case vexnorMssql.name:
                  return mssqlPool.request();
               case vexnorPostgres.name:
                  return pgPool;
               case vexnorSqlite3.name:
                  return sqliteDb;
               default:
                  throw new Error(`Unknown plugin: ${p}`);
            }
         },
         { token },
      );
      return c.json(result);
   } catch (err) {
      return c.json(err, 403);
   }
});

app.use("*", serveStatic({ root: "./dist/client" }));
app.use("*", serveStatic({ path: "./dist/client/index.html" }));

serve({ fetch: app.fetch, port: 3001 }, (info) => {
   console.log(`Server running at http://localhost:${info.port}`);
});
