import { GetSchemaArgs, logger, Schema, SqlColumnInfo, SqlColumnType, ValnorPlugin } from "valnor/plugin";
import Database, { type RunResult } from "better-sqlite3";
import { findEnums, findTables, getColumnType } from "./cli/index.js";
import { RowOut, SqlQuery } from "valnor/core";
import { BetterSqlite3QueryHandler } from "./better-sqlite3-query-handler.js";

export class ValnorSqlite3 extends ValnorPlugin {
   driver = "sqlite3";

   getColumnType(col: SqlColumnInfo): SqlColumnType {
      return getColumnType(col);
   }

   async getSchema(args: GetSchemaArgs): Promise<Schema> {
      const { schemas } = args;

      let db: Database.Database;
      if ("uri" in args) {
         db = new Database(args.uri);
      } else {
         throw new Error("SQLite requires database file path in uri parameter");
      }

      const tables = findTables.sqlite.getAll(db);
      const enums = findEnums.sqlite.getAll(db);

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
         enums,
      };
   }
}

// Extend the class type (in scope)
declare module "valnor/core" {
   interface SqlQuery<T extends { Row: RowOut; Params: Record<string, unknown> | undefined }> {
      readonly sqlite: BetterSqlite3QueryHandler<T & { QueryResult: RunResult }>;
   }
}

Object.defineProperty(SqlQuery.prototype, "sqlite", {
   get: function () {
      return new BetterSqlite3QueryHandler(this);
   },
});
