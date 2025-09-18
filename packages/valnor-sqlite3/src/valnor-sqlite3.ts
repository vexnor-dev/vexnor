import {
   GetSchemaArgs,
   LibraryOutputFile,
   logger,
   SqlColumnInfo,
   SqlColumnType,
   SqlSchema,
   ValnorPlugin,
} from "valnor/plugin";
import Database, { type RunResult } from "better-sqlite3";
import { findPrimaryKey, findTableColumns, findTables, getColumnType } from "./cli/index.js";
import {
   RowOut,
   SqlColumn,
   SqlColumnFormat,
   SqlQuery,
   SqlQueryContext,
   SqlTableAny,
   SqlTableFormat,
} from "valnor/core";
import { BetterSqlite3QueryHandler } from "./better-sqlite3-query-handler.js";

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
         db = new Database(args.uri);
      } else {
         throw new Error("SQLite requires database file path in uri parameter");
      }

      const tables = findTables.sqlite3.getAll(db);

      // Populate columns and primary keys for each table
      for (const table of tables) {
         const columns = findTableColumns.sqlite3.getAll(db, { tableName: table.table_name });
         const primaryKeys = findPrimaryKey.sqlite3.getAll(db, { tableName: table.table_name });
         const primaryKey = primaryKeys[0];

         table.table_columns = columns;
         table.primary_key = primaryKey?.name;
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

   override getTableFormat(table: SqlTableAny, context: SqlQueryContext): SqlTableFormat {
      switch (context.keyword) {
         case "insert into":
         case "update":
            return "schema.table";
         default:
            return super.getTableFormat(table, context);
      }
   }

   override getColumnFormat(column: SqlColumn, context: SqlQueryContext): SqlColumnFormat {
      switch (context.keyword) {
         case "insert into":
            return "column";
         case "set":
            return "tableName.column";
         case "returning":
            return "tableName.column as alias";
         default:
            return super.getColumnFormat(column, context);
      }
   }
}

// Extend the class type (in scope)
declare module "valnor/core" {
   interface SqlQuery<T extends { Row: RowOut; Params: Record<string, unknown> | undefined }> {
      readonly sqlite3: BetterSqlite3QueryHandler<T & { QueryResult: RunResult }>;
   }
}

Object.defineProperty(SqlQuery.prototype, "sqlite3", {
   get: function () {
      return new BetterSqlite3QueryHandler(this);
   },
});
