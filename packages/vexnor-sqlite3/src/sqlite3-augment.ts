import { SqlQuery, SqlTable, newSqlQueryHandler } from "vexnor";
import { BetterSqlite3QueryHandler } from "#/better-sqlite3-query-handler.js";
import { newSqlite3TableHandler, Sqlite3TableHandler } from "#/crud/sqlite3-table-handler.js";

declare module "vexnor" {
   interface SqlQuery<T extends { Row?: unknown; Params?: unknown }> {
      readonly sqlite: BetterSqlite3QueryHandler<T>;
   }
   interface SqlTable<
      T extends {
         Select: Record<string, unknown>;
         Insert?: Record<string, unknown>;
         Update?: Record<string, unknown>;
         Delete?: boolean;
      },
   > {
      readonly sqlite: Sqlite3TableHandler<T>;
   }
}

Object.defineProperty(SqlQuery.prototype, "sqlite", {
   get: function () {
      return newSqlQueryHandler(new BetterSqlite3QueryHandler(this));
   },
});

Object.defineProperty(SqlTable.prototype, "sqlite", {
   get: function () {
      return newSqlite3TableHandler(this);
   },
});
