import { SqlQuery, SqlTable, newSqlQueryHandler } from "@vexnor/core";
import { MssqlQueryHandler } from "#src/mssql-query-handler.js";
import { newMssqlTableHandler, MssqlTableHandler } from "#src/crud/mssql-table-handler.js";

declare module "@vexnor/core" {
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

if (!Object.hasOwn(SqlQuery.prototype, "mssql")) {
   Object.defineProperty(SqlQuery.prototype, "mssql", {
      get: function () {
         return newSqlQueryHandler(new MssqlQueryHandler(this));
      },
   });
}

if (!Object.hasOwn(SqlTable.prototype, "mssql")) {
   Object.defineProperty(SqlTable.prototype, "mssql", {
      get: function () {
         return newMssqlTableHandler(this);
      },
   });
}
