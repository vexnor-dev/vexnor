import {
   ConnectionConfig,
   GetSchemaArgs,
   LibraryOutputFile,
   logger,
   SqlColumnInfo,
   SqlColumnType,
   SqlSchema,
   SqlTableInfo,
   ValnorConnection,
   ValnorPlugin,
} from "valnor/plugin";
import { MssqlQueryHandler } from "./mssql-query-handler.js";
import { AsyncQueryHandler, SqlQuery } from "valnor";
import { getColumnType } from "./get-column-type.js";
import { findTables } from "./schema/find-tables.js";
import mssql from "mssql";

/**
 * Valnor plugin for MS SQL Server.
 */
export class ValnorMssql extends ValnorPlugin<{ Config: ConnectionConfig; Connection: mssql.ConnectionPool }> {
   driver = "mssql";

   getLibrary(): LibraryOutputFile[] {
      return [];
   }

   getColumnType(col: SqlColumnInfo): SqlColumnType {
      return getColumnType(col);
   }

   async getSchema(args: GetSchemaArgs<ConnectionConfig>): Promise<SqlSchema> {
      const { schemas } = args;
      const connection = await this.createConnection(args);
      try {
         const result = await findTables.mssql
            .getAll({
               db: connection.db.request(),
               params: { schemas },
               options: {
                  debug: (args) => {
                     console.log(args.text);
                  },
               },
            })
            .catch((err) => {
               console.error(err);
               throw err;
            });
         const tables: SqlTableInfo[] = result.map((row) => ({
            table_name: row.table_name,
            table_schema: row.table_schema,
            columns: typeof row.table_columns === "string" ? JSON.parse(row.table_columns || "[]") : row.table_columns,
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
         }));
         logger.info(
            {
               mssql: (() => {
                  return { driver: connection.db.driver };
               })(),
               schemas,
               tables: tables.map(({ table_name, table_schema }) => ({ table_schema, table_name })),
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

   async createConnection<Config extends ConnectionConfig>(
      config: Config,
   ): Promise<ValnorConnection<mssql.ConnectionPool>> {
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

      return new ValnorConnection(pool, (p) => p.close());
   }

   newQueryHandler<T extends { Row?: unknown; Params?: unknown; QueryResult: object; QueryClient: unknown }>(
      query: SqlQuery<{ Params: T["Params"]; Row: T["Row"] }>,
   ): AsyncQueryHandler<T> {
      const handler: MssqlQueryHandler<T> = new MssqlQueryHandler(query);
      return handler;
   }
}

// Extend the class type (in scope)
declare module "valnor" {
   interface SqlQuery<T extends { Row?: unknown; Params?: unknown }> {
      readonly mssql: MssqlQueryHandler<T>;
   }
}

Object.defineProperty(SqlQuery.prototype, "mssql", {
   get: function () {
      return new MssqlQueryHandler(this);
   },
});
