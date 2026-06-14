import {
   ConnectionConfig,
   GetSchemaArgs,
   LibraryOutputFile,
   logger,
   SqlColumnInfo,
   SqlColumnType,
   SqlSchema,
   SqlTableInfo,
   VexnorConnection,
   VexnorPlugin,
} from "vexnor/plugin";
import { MssqlQueryHandler, PLUGIN_NAME } from "./mssql-query-handler.js";
import { SqlQueryHandler, SqlQuery } from "vexnor";
import "#/mssql-augment.js";
import { getColumnType } from "./get-column-type.js";
import { findTables, findViews } from "./schema/find-tables.js";
import mssql from "mssql";

/**
 * Vexnor plugin for MS SQL Server.
 */
export class VexnorMssql extends VexnorPlugin<{ Config: ConnectionConfig; Connection: mssql.ConnectionPool }> {
   readonly name = PLUGIN_NAME;
   driver = "mssql";
   dialect = "tsql";

   getLibrary(): LibraryOutputFile[] {
      return [];
   }

   getColumnType(col: SqlColumnInfo): SqlColumnType {
      return getColumnType(col);
   }

   async getSchema(args: GetSchemaArgs<ConnectionConfig>): Promise<SqlSchema> {
      const { schemas } = args;
      const connection = await this.createConnection({ config: args });
      try {
         const result = await findTables.mssql
            .all({
               db: (connection.db as mssql.ConnectionPool).request(),
               params: { schemas },
            })
            .catch((err) => {
               console.error(err);
               throw err;
            });
         const viewResult = await findViews.mssql
            .all({
               db: (connection.db as mssql.ConnectionPool).request(),
               params: { schemas },
            })
            .catch((err) => {
               console.error(err);
               throw err;
            });
         const tables: SqlTableInfo[] = [
            ...result.map((row) => ({
               table_type: "table" as const,
               table_name: row.table_name,
               table_schema: row.table_schema,
               columns:
                  typeof row.table_columns === "string" ? JSON.parse(row.table_columns || "[]") : row.table_columns,
               primary_keys: row.primary_key
                  ? [
                       {
                          constraint_name: "PK_" + row.table_name,
                          table_schema: row.table_schema,
                          table_name: row.table_name,
                          column_name: row.primary_key,
                       },
                    ]
                  : [],
            })),
            ...viewResult.map((row) => ({
               table_type: "view" as const,
               table_name: row.table_name,
               table_schema: row.table_schema,
               columns:
                  typeof row.table_columns === "string" ? JSON.parse(row.table_columns || "[]") : row.table_columns,
               primary_keys: [],
            })),
         ];
         logger.info(
            {
               mssql: (() => {
                  return { driver: (connection.db as mssql.ConnectionPool).driver };
               })(),
               schemas,
               tables: tables.map(({ table_name, table_schema, table_type }) => ({
                  table_schema,
                  table_name,
                  table_type,
               })),
            },
            `Generating mapping code for ${schemas.join(", ")}`,
         );
         return {
            tables,
            enums: [], // MS SQL Server doesn't have enums in the same way as PostgreSQL
         };
      } finally {
         await connection?.close();
      }
   }

   async createConnection<TContext extends Record<string, unknown>>({
      config,
   }: {
      config: ConnectionConfig;
      context?: TContext;
   }): Promise<VexnorConnection<{ Connection: mssql.ConnectionPool; Context: TContext }>> {
      const pool = (() => {
         if ("uri" in config) {
            return new mssql.ConnectionPool(config.uri);
         }

         const { host, port, database, user, password } = config;
         if (host && database && user) {
            return new mssql.ConnectionPool({
               server: host,
               port,
               user,
               password,
               database,
               options: {
                  encrypt: true, // for Azure SQL
                  trustServerCertificate: true, // change to false for production
               },
            });
         }

         throw new Error(`Invalid database connection parameters: host, database and user are required`);
      })();

      await pool.connect();

      return new VexnorConnection(pool, (p: mssql.ConnectionPool) => p.close());
   }

   newQueryHandler<Args extends { Row?: unknown; Params?: unknown; Read: object; Write: object }>(
      query: SqlQuery<Pick<Args, "Row" | "Params">>,
   ): SqlQueryHandler<Pick<Args, "Row" | "Params" | "Read" | "Write"> & { Connection: mssql.ConnectionPool }> {
      return new MssqlQueryHandler(query) as SqlQueryHandler<
         Pick<Args, "Row" | "Params" | "Read" | "Write"> & { Connection: mssql.ConnectionPool }
      >;
   }
}

export const vexnorMssql = new VexnorMssql();
