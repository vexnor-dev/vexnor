import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { HttpRemoteClient, SqlErrorCode } from "@vexnor/core";
import { SqlError, SqlRunError, SqlQueryRegistry, type QueryMap } from "@vexnor/core/execution";
import vexnorPostgres from "@vexnor/postgres";
import vexnorMssql from "@vexnor/mssql";
import vexnorSqlite3 from "@vexnor/sqlite3";
import { pgPool, mssqlPool, sqliteDb } from "./config.js";
import type { AddressInfo } from "node:net";

export async function createTestServer(queries: {
   postgres?: QueryMap;
   mssql?: QueryMap;
   sqlite3?: QueryMap;
}): Promise<{ client: HttpRemoteClient; stop: () => Promise<void> }> {
   const registry = new SqlQueryRegistry();

   if (queries.postgres) await registry.register(vexnorPostgres, queries.postgres);
   if (queries.mssql) await registry.register(vexnorMssql, queries.mssql);
   if (queries.sqlite3) await registry.register(vexnorSqlite3, queries.sqlite3);

   const app = new Hono();

   app.post("/api/db", async (c) => {
      const args = await c.req.json();
      try {
         const result = await registry.execute(args, async ({ plugin }) => {
            switch (plugin.name) {
               case vexnorPostgres.name: return pgPool;
               case vexnorMssql.name: return mssqlPool.request();
               case vexnorSqlite3.name: return sqliteDb;
               default: throw new Error(`Unknown plugin: ${plugin.name}`);
            }
         });
         return c.json(result);
      } catch (err) {
         if (err instanceof SqlRunError || err instanceof SqlError) {
            const statusMap: Record<SqlErrorCode, number> = {
               QUERY_NOT_FOUND: 400,
               QUERY_BUILD_FAILED: 400,
               PARAM_VALIDATION_FAILED: 400,
               QUERY_PARAMETERS_INVALID: 400,
               QUERY_NOT_AUTHORIZED: 403,
               REGISTRY_NOT_AUTHORIZED: 403,
               QUERY_RATE_LIMITED: 429,
               QUERY_EXECUTION_FAILED: 500,
               QUERY_RETRYABLE_FAILURE: 503,
               QUERY_TIMEOUT: 504,
               CONNECTION_NOT_VALID: 500,
            };
            const status = statusMap[err.code] ?? 500;
            return c.json({ error: err.message, code: err.code }, status as never);
         }
         return c.json({ error: String(err) }, 500);
      }
   });

   const server = serve({ fetch: app.fetch, port: 0 });
   const port = (server.address() as AddressInfo).port;
   const client = new HttpRemoteClient({ targetUrl: `http://localhost:${port}/api/db` });

   const stop = () =>
      new Promise<void>((resolve, reject) =>
         server.close((err) => (err ? reject(err) : resolve())),
      );

   return { client, stop };
}
