import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import path from "node:path";
import pg from "pg";
import mssql from "mssql";
import BetterSqlite3 from "better-sqlite3";
import pino from "pino";
import * as postgresQueries from "../../shared/queries/postgres.js";
import * as mssqlQueries from "../../shared/queries/mssql.js";
import * as sqlite3Queries from "../../shared/queries/sqlite3.js";
import vexnorMssql from "vexnor-mssql";
import vexnorPostgres from "vexnor-postgres";
import vexnorSqlite3 from "vexnor-sqlite3";
import { QueryRegistry } from "vexnor/registry";

const log = pino({ name: "vexnor" });
const queryRegistry = new QueryRegistry();

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

queryRegistry.registerAuditLog((event) => {
   const { query, name, plugin, durationMs, error, location } = event.args;
   const meta = { name, query: query.label, plugin: plugin.name, durationMs, location };
   if (error) {
      log.error({ ...meta, err: error }, "query failed");
   } else {
      log.info(meta, "query executed");
   }
});

const app = new Hono();

app.use("*", logger());
app.use("/api/*", cors());

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.post("/api/db", async (c) => {
   const { plugin, hash, params } = await c.req.json<{
      plugin: string;
      hash: string;
      params: Record<string, unknown>;
   }>();
   try {
      const result = await queryRegistry.execute(plugin, hash, params ?? {}, async (p: string) => {
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
      });
      return c.json(result);
   } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith("Unknown query hash")) return c.json({ error: message }, 403);
      throw err;
   }
});

app.use("*", serveStatic({ root: "./dist/client" }));
app.use("*", serveStatic({ path: "./dist/client/index.html" }));

serve({ fetch: app.fetch, port: 3001 }, (info) => {
   console.log(`Server running at http://localhost:${info.port}`);
});
