import {
   GetSchemaArgs,
   LibraryOutputFile,
   logger,
   SqlColumnInfo,
   SqlColumnType,
   SqlSchema,
   ValnorPlugin,
} from "valnor/plugin";
import Database from "better-sqlite3";
import { findPrimaryKeys, findTableColumns, findTables, getColumnType } from "./schema/index.js";
import { SqlQueryParams, SqlQueryRowOut, SqlQuery } from "valnor";
import { BetterSqlite3QueryHandler } from "./better-sqlite3-query-handler.js";
import { resolve } from "node:path";

export class ValnorSqlite3 extends ValnorPlugin {
   driver = "better-sqlite3";

   getLibrary(): LibraryOutputFile[] {
      return [];
   }

   getColumnType(col: SqlColumnInfo): SqlColumnType {
      return getColumnType(col);
   }

   async getSchema(args: GetSchemaArgs): Promise<SqlSchema> {
      const { schemas } = args;

      let db: Database.Database;
      if ("uri" in args) {
         logger.info({ URI: resolve(args.uri) }, "Opening Sqlite3 database connection");
         db = new Database(args.uri);
      } else {
         throw new Error("SQLite requires database file path in uri parameter");
      }

      const tables = await findTables.sqlite3.getAll({ db });

      // Populate columns and primary keys for each table
      for (const table of tables) {
         const columns = await findTableColumns.sqlite3.getAll({ db, params: { tableName: table.table_name } });
         const primaryKeys = await findPrimaryKeys.sqlite3.getAll({ db, params: { tableName: table.table_name } });

         table.table_columns = columns;
         table.primary_keys = primaryKeys.map((z) => z.name);
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
         tables,
         enums: [],
      };
   }
}

// Extend the class type (in scope)
declare module "valnor" {
   interface SqlQuery<T extends { Row: SqlQueryRowOut; Params?: SqlQueryParams }> {
      readonly sqlite3: BetterSqlite3QueryHandler<T>;
   }
}

Object.defineProperty(SqlQuery.prototype, "sqlite3", {
   get: function () {
      return new BetterSqlite3QueryHandler(this);
   },
});
