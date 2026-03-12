import {
   LibraryOutputFile,
   logger,
   SqlColumnInfo,
   SqlColumnType,
   SqlSchema,
   SqlTableInfo,
   ValnorConnection,
   ValnorPlugin,
} from "valnor/plugin";
import BetterSqlite3 from "better-sqlite3";
import { findPrimaryKeys, findTableColumns, findTables } from "#/schema/find-tables.js";
import { getColumnType } from "#/schema/get-column-type.js";
import { SqlQueryHandler, SqlQuery } from "valnor";
import { BetterSqlite3QueryHandler } from "#/better-sqlite3-query-handler.js";
import { resolve } from "node:path";

export type Sqlite3ConnectionConfig = { uri: string };

export class ValnorSqlite3 extends ValnorPlugin<{
   Config: Sqlite3ConnectionConfig;
   Connection: BetterSqlite3.Database;
}> {
   driver = "better-sqlite3";
   dialect = "sqlite3";

   newQueryHandler<T extends { Row?: unknown; Params?: unknown; QueryResult: object; Connection: unknown }>(
      query: SqlQuery<{ Params: T["Params"]; Row: T["Row"] }>,
   ): SqlQueryHandler<T> {
      return new BetterSqlite3QueryHandler(query);
   }

   getLibrary(): LibraryOutputFile[] {
      return [];
   }

   getColumnType(col: SqlColumnInfo): SqlColumnType {
      return getColumnType(col);
   }

   async getSchema(args: Sqlite3ConnectionConfig & { schemas: string[] }): Promise<SqlSchema> {
      const { schemas } = args;

      let db: BetterSqlite3.Database;
      if ("uri" in args) {
         logger.info({ URI: resolve(args.uri) }, "Opening Sqlite3 database connection");
         db = new BetterSqlite3(args.uri);
      } else {
         throw new Error("SQLite requires database file path in uri parameter");
      }

      const runArgs: Parameters<typeof findTables.sqlite3.getAll>[0] = {
         db,
         options: { dialect: "sqlite" },
      };

      const tables = await findTables.sqlite3.getAll({ ...runArgs });

      // Populate columns and primary keys for each table
      const newTables: SqlTableInfo[] = [];
      for (const table of tables) {
         const columns = await findTableColumns.sqlite3.getAll({ ...runArgs, params: { tableName: table.table_name } });
         const primaryKeys = await findPrimaryKeys.sqlite3.getAll({
            ...runArgs,
            params: { tableName: table.table_name },
         });

         newTables.push({
            primary_keys: primaryKeys.map((z) => ({
               ...z,
               table_schema: table.table_schema,
               table_name: table.table_name,
            })),
            ...table,
            columns: columns.map((z) => ({ ...z, table_name: table.table_name, table_schema: table.table_schema })),
         });
      }

      logger.info(
         {
            sqlite: { database: "uri" in args ? args.uri : "unknown" },
            schemas,
            tables: tables.map(({ table_name, table_schema }) => ({ table_schema, table_name })),
            enums: [],
         },
         `Generating mapping code for SQLite database`,
      );

      db.close();

      return {
         tables: newTables,
         enums: [],
      };
   }

   async createConnection(config: Sqlite3ConnectionConfig): Promise<ValnorConnection<BetterSqlite3.Database>> {
      const db = new BetterSqlite3(config.uri);
      return new ValnorConnection(db, (db) => {
         Promise.resolve(() => {
            db.close();
         });
      });
   }
}

// Extend the class type (in scope)
declare module "valnor" {
   interface SqlQuery<T extends { Row?: unknown; Params?: unknown }> {
      readonly sqlite3: BetterSqlite3QueryHandler<T>;
   }
}

Object.defineProperty(SqlQuery.prototype, "sqlite3", {
   get: function () {
      return new BetterSqlite3QueryHandler(this);
   },
});
