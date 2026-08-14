import {
   ConnectionConfig,
   GetSchemaArgs,
   LibraryOutputFile,
   logger,
   SqlColumnInfo,
   SqlColumnType,
   SqlForeignKeyInfo,
   SqlPrimaryKeyInfo,
   SchemaNamespace,
   SqlSchema,
   SqlTableInfo,
   VexnorConnection,
   VexnorPlugin,
} from "@vexnor/core/plugin";
import { MssqlQueryHandler, PLUGIN_NAME } from "./mssql-query-handler.js";
import { SqlQueryHandler, SqlQuery, type SqlQueryAny, type SqlTableAny } from "@vexnor/core";
import { MssqlSelectCommand } from "#src/crud/mssql-select-command.js";
import "#src/mssql-augment.js";
import { getColumnType } from "./get-column-type.js";
import { findForeignKeys, findPrimaryKeys, findTables, findViews } from "./schema/find-tables.js";
import { findSchemas } from "./schema/find-schemas.js";
import mssql from "mssql";
import pkg from "../package.json" with { type: "json" };

const SYSTEM_SCHEMAS = new Set([
   "db_accessadmin",
   "db_backupoperator",
   "db_datareader",
   "db_datawriter",
   "db_ddladmin",
   "db_denydatareader",
   "db_denydatawriter",
   "db_owner",
   "db_securityadmin",
   "guest",
   "INFORMATION_SCHEMA",
   "sys",
]);

/**
 * Vexnor plugin for MS SQL Server.
 */
export class VexnorMssql extends VexnorPlugin<{ Config: ConnectionConfig; Connection: mssql.ConnectionPool }> {
   readonly name = PLUGIN_NAME;
   override readonly version = pkg.version;
   driver = "mssql";
   dialect = "tsql";

   getLibrary(): LibraryOutputFile[] {
      return [];
   }

   getColumnType(col: SqlColumnInfo): SqlColumnType {
      return getColumnType(col);
   }

   async discoverSchemas(config: ConnectionConfig): Promise<SchemaNamespace[]> {
      const connection = await this.createConnection({ config });
      try {
         const schemas = await findSchemas.mssql.all({
            db: (connection.db as mssql.ConnectionPool).request(),
         });
         return schemas.map(({ name }) => ({ name, system: SYSTEM_SCHEMAS.has(name) }));
      } finally {
         await connection.close();
      }
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
         const primaryKeyResult = await findPrimaryKeys.mssql
            .all({
               db: (connection.db as mssql.ConnectionPool).request(),
               params: { schemas },
            })
            .catch((err) => {
               console.error(err);
               throw err;
            });
         const fkResult = await findForeignKeys.mssql
            .all({
               db: (connection.db as mssql.ConnectionPool).request(),
               params: { schemas },
            })
            .catch((err) => {
               console.error(err);
               throw err;
            });
         const primaryKeysByTable = new Map<string, SqlPrimaryKeyInfo[]>();
         for (const primaryKey of primaryKeyResult) {
            const key = `${primaryKey.table_schema}.${primaryKey.table_name}`;
            const list = primaryKeysByTable.get(key) ?? [];
            list.push(primaryKey);
            primaryKeysByTable.set(key, list);
         }
         const fkByTable = new Map<string, SqlForeignKeyInfo[]>();
         for (const fk of fkResult) {
            const key = `${fk.table_schema}.${fk.table_name}`;
            const list = fkByTable.get(key) ?? [];
            list.push({
               constraint_name: fk.constraint_name,
               column_name: fk.column_name,
               table_schema: fk.table_schema,
               table_name: fk.table_name,
               referenced_table_schema: fk.referenced_table_schema,
               referenced_table_name: fk.referenced_table_name,
               referenced_column_name: fk.referenced_column_name,
               ordinal_position: fk.ordinal_position,
            });
            fkByTable.set(key, list);
         }
         const tables: SqlTableInfo[] = [
            ...result.map((row) => ({
               table_type: "table" as const,
               table_name: row.table_name,
               table_schema: row.table_schema,
               columns:
                  typeof row.table_columns === "string" ? JSON.parse(row.table_columns || "[]") : row.table_columns,
               primary_keys: primaryKeysByTable.get(`${row.table_schema}.${row.table_name}`) ?? [],
               foreign_keys: fkByTable.get(`${row.table_schema}.${row.table_name}`) ?? [],
            })),
            ...viewResult.map((row) => ({
               table_type: "view" as const,
               table_name: row.table_name,
               table_schema: row.table_schema,
               columns:
                  typeof row.table_columns === "string" ? JSON.parse(row.table_columns || "[]") : row.table_columns,
               primary_keys: [],
               foreign_keys: [],
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

   override newSelectQuery(
      table: SqlTableAny,
      joinMap?: Record<string, SqlTableAny>,
   ): SqlQueryAny {
      return new MssqlSelectCommand(table, {}, joinMap).build();
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
