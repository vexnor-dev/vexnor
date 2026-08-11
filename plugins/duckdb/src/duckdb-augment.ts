import { IsUnion, MultiSourceError, newSqlQueryHandler, SqlQuery, SqlTable } from "@vexnor/core";
import { DuckDBQueryHandler } from "#src/duckdb-query-handler.js";
import { newDuckDBTableHandler, DuckDBTableHandler } from "#src/crud/duckdb-table-handler.js";

declare module "@vexnor/core" {
   interface SqlQuery<T extends { Row?: unknown; Params?: unknown; Sources?: string }> {
      readonly duckdb: [T["Sources"]] extends [never]
         ? DuckDBQueryHandler<T>
         : IsUnion<T["Sources"]> extends true
            ? MultiSourceError
            : DuckDBQueryHandler<T>;
   }
   interface SqlTable<
      T extends {
         Select: Record<string, unknown>;
         Insert?: Record<string, unknown>;
         Update?: Record<string, unknown>;
         Delete?: boolean;
         Source?: string;
      },
   > {
      readonly duckdb: DuckDBTableHandler<T>;
   }
}

if (!Object.hasOwn(SqlQuery.prototype, "duckdb")) {
   Object.defineProperty(SqlQuery.prototype, "duckdb", {
      get: function () {
         return newSqlQueryHandler(new DuckDBQueryHandler(this));
      },
   });
}

if (!Object.hasOwn(SqlTable.prototype, "duckdb")) {
   Object.defineProperty(SqlTable.prototype, "duckdb", {
      get: function () {
         return newDuckDBTableHandler(this);
      },
   });
}
