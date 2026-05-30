import { SqlQuery, SqlTable, newSqlQueryHandler } from "vexnor";
import { MssqlQueryHandler } from "#/mssql-query-handler.js";
import { newMssqlTableHandler, MssqlTableHandler } from "#/crud/mssql-table-handler.js";

declare module "vexnor" {
   interface SqlQuery<T extends { Row?: unknown; Params?: unknown }> {
      readonly mssql: MssqlQueryHandler<T>;
   }
   interface SqlTable<
      T extends {
         Select: Record<string, unknown>;
         Insert?: Record<string, unknown>;
         Update?: Record<string, unknown>;
         Delete?: boolean;
      },
   > {
      readonly mssql: MssqlTableHandler<T>;
   }
}

Object.defineProperty(SqlQuery.prototype, "mssql", {
   get: function () {
      return newSqlQueryHandler(new MssqlQueryHandler(this));
   },
});

Object.defineProperty(SqlTable.prototype, "mssql", {
   get: function () {
      return newMssqlTableHandler(this);
   },
});
