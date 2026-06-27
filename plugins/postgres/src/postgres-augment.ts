import { SqlQuery, SqlTable, newSqlQueryHandler } from "@vexnor/core";
import { PostgresQueryHandler } from "#src/postgres-query-handler.js";
import { newPostgresTableHandler, PostgresTableHandler } from "#src/crud/postgres-table-handler.js";

declare module "@vexnor/core" {
   interface SqlQuery<T extends { Row?: unknown; Params?: unknown }> {
      readonly postgres: PostgresQueryHandler<T>;
   }
   interface SqlTable<
      T extends {
         Select: Record<string, unknown>;
         Insert?: Record<string, unknown>;
         Update?: Record<string, unknown>;
         Delete?: boolean;
      },
   > {
      readonly postgres: PostgresTableHandler<T>;
   }
}

if (!Object.hasOwn(SqlQuery.prototype, "postgres")) {
   Object.defineProperty(SqlQuery.prototype, "postgres", {
      get: function () {
         return newSqlQueryHandler(new PostgresQueryHandler(this));
      },
   });
}

if (!Object.hasOwn(SqlTable.prototype, "postgres")) {
   Object.defineProperty(SqlTable.prototype, "postgres", {
      get: function () {
         return newPostgresTableHandler(this);
      },
   });
}
