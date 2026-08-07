import { SqlError, SqlRunError } from "@vexnor/core/execution";
import { SqlQueryRegistry } from "@vexnor/core/execution";
import vexnorPostgres from "@vexnor/postgres";
import vexnorMssql from "@vexnor/mssql";
import vexnorSqlite3 from "@vexnor/sqlite3";
import { MongoQueryRegistry, MONGODB_PLUGIN_NAME } from "@vexnor/mongodb";
import { pgPool } from "@/shared/db/postgres";
import { getMssqlPool } from "@/shared/db/mssql";
import { sqliteDb } from "@/shared/db/sqlite3";
import { mongoDb } from "@/shared/db/mongodb";
import { queries as postgresQueries } from "@/shared/queries/postgres";
import * as mssqlQueries from "@/shared/queries/mssql";
import * as sqlite3Queries from "@/shared/queries/sqlite3";
import {
   findAccounts,
   deleteAccount,
   insertAccount,
   findProductsByTag,
   findProductsByBrand,
   findProductsByCountry,
   findProductsByColor,
   findOrdersByStatus,
   findOrdersByProduct,
   findExpensiveOrders,
   revenueByStatus,
   topBrandsByOrders,
   ordersWithAccount,
   productsBySize,
   productsByCountry,
} from "@/shared/queries/mongodb";
import { SqlExecuteMode } from "@vexnor/core";

const mongoQueries = {
   findAccounts,
   deleteAccount,
   insertAccount,
   findProductsByTag,
   findProductsByBrand,
   findProductsByCountry,
   findProductsByColor,
   findOrdersByStatus,
   findOrdersByProduct,
   findExpensiveOrders,
   revenueByStatus,
   topBrandsByOrders,
   ordersWithAccount,
   productsBySize,
   productsByCountry,
};

const SQL_ERROR_STATUS: Record<string, number> = {
   QUERY_NOT_FOUND: 400,
   QUERY_BUILD_FAILED: 400,
   PARAM_VALIDATION_FAILED: 400,
   QUERY_NOT_AUTHORIZED: 403,
   REGISTRY_NOT_AUTHORIZED: 403,
   QUERY_RATE_LIMITED: 429,
   QUERY_EXECUTION_FAILED: 500,
   QUERY_RETRYABLE_FAILURE: 503,
   QUERY_TIMEOUT: 504,
};

const registry = new SqlQueryRegistry();
await registry.register(vexnorPostgres, postgresQueries);
await registry.register(vexnorMssql, mssqlQueries);
await registry.register(vexnorSqlite3, sqlite3Queries);

const mongoRegistry = new MongoQueryRegistry();
await mongoRegistry.register(mongoQueries);

export async function POST(request: Request) {
   const args = (await request.json()) as {
      plugin: string;
      hash: string;
      params: Record<string, unknown>;
      name: string | null;
      location: string | null;
      mode: SqlExecuteMode;
   };
   const token = request.headers.get("Authorization")?.replace("Bearer ", "") ?? null;

   try {
      // Route MongoDB queries to MongoQueryRegistry
      if (args.plugin === MONGODB_PLUGIN_NAME) {
         const result = await mongoRegistry.execute(
            { hash: args.hash, params: args.params, mode: args.mode as "read" | "write" },
            mongoDb,
            { token },
         );
         return Response.json(result);
      }

      // SQL queries via SqlQueryRegistry
      const result = await registry.execute(
         args,
         async ({ plugin }) => {
            switch (plugin.name) {
               case vexnorPostgres.name:
                  return pgPool;
               case vexnorMssql.name:
                  return (await getMssqlPool()).request();
               case vexnorSqlite3.name:
                  return sqliteDb;
               default:
                  throw new Error(`Unknown plugin: ${plugin}`);
            }
         },
         { token },
      );
      return Response.json(result);
   } catch (err) {
      if (err instanceof SqlRunError || err instanceof SqlError) {
         const status = SQL_ERROR_STATUS[err.code] ?? 500;
         return Response.json({ error: err.message, code: err.code }, { status });
      }
      throw err;
   }
}
