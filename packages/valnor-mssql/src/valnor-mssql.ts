import {
   GetSchemaArgs,
   LibraryOutputFile,
   logger,
   SqlColumnInfo,
   SqlColumnType,
   SqlSchema,
   SqlTableInfo,
   ValnorPlugin,
   x,
} from "valnor/plugin";
import mssql from "mssql";
import { MssqlQueryHandler } from "./mssql-query-handler.js";
import { Params, RowOut, SqlQuery } from "valnor";
import { getColumnType } from "./get-column-type.js";
import { findTables } from "./cli/find-tables.js";

const { ConnectionPool } = mssql;

/**
 * Valnor plugin for MS SQL Server.
 */
export class ValnorMssql extends ValnorPlugin {
   driver = "mssql";

   getLibrary(): LibraryOutputFile[] {
      return [];
   }

   getColumnType(col: SqlColumnInfo): SqlColumnType {
      return getColumnType(col);
   }

   async getSchema(args: GetSchemaArgs): Promise<SqlSchema> {
      const { schemas } = args;
      const pool = x(() => {
         if ("uri" in args) {
            return new ConnectionPool(args.uri);
         }

         const { host, port, database, user, password } = args;
         if (host && database && user) {
            return new ConnectionPool({
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
      });

      let connection = undefined;
      try {
         connection = await pool.connect();
         const result = await findTables.mssql.getAll({
            db: connection.request(),
            params: { schemas },
            options: {
               debug: (args) => {
                  console.log(args);
               },
            },
         });
         const tables = result.map((row: SqlTableInfo) => ({
            ...row,
            table_columns:
               typeof row.table_columns === "string" ? JSON.parse(row.table_columns || "[]") : row.table_columns,
         }));
         logger.info(
            {
               mssql: x(() => {
                  return { driver: pool.driver };
               }),
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
}

// Extend the class type (in scope)
declare module "valnor" {
   interface SqlQuery<T extends { Row: RowOut; Params?: Params }> {
      readonly mssql: MssqlQueryHandler<T>;
   }
}

Object.defineProperty(SqlQuery.prototype, "mssql", {
   get: function () {
      return new MssqlQueryHandler(this);
   },
});
