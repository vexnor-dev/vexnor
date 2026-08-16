import {
   info,
   ParamsOfArgs,
   Sql,
   type SqlFilterParams,
   type SqlHavingByParams,
   type SqlOrderByParams,
   type SqlPaginationParams,
   type SqlProjectByParams,
   SqlQueryColumns,
   SqlSelectArgs,
   SqlSelectCommand,
   SqlSelectHooks,
   SqlSelectResultRow,
   SqlTable,
   SqlTableAny,
   type SqlWindowByParams,
} from "@vexnor/core";
import { jsonMany, jsonOne } from "#src/charms/json-aggregation-duckdb.js";
import { DuckDBProjectBy } from "#src/crud/duckdb-project-by.js";
import { DuckDBQueryHandler } from "#src/duckdb-query-handler.js";
import "#src/duckdb-augment.js";

export type DuckDBSelectCommandResult<T extends { Select: Record<string, unknown> }, Args extends SqlSelectArgs<T>> =
   DuckDBQueryHandler<{
      Row: SqlSelectResultRow<T, Args>;
      Params: (ParamsOfArgs<Args> extends void ? unknown : ParamsOfArgs<Args>)
         & SqlFilterParams<T, "filterBy">
         & SqlOrderByParams<T, "orderBy">
         & SqlPaginationParams
         & SqlProjectByParams<T>
         & SqlHavingByParams
         & SqlWindowByParams<T>;
   }> & SqlQueryColumns<SqlSelectResultRow<T, Args>>;

export class DuckDBSelectCommand<T extends { Select: Record<string, unknown> }, Args extends SqlSelectArgs<T>>
   extends SqlSelectCommand<T, Args> {
   constructor(table: SqlTable<T>, args: Args) {
      const { includeOne, includeMany, ...baseArgs } = args;
      const ones = Object.entries(includeOne ?? {}).map(([key, query]) => ({ key, charm: jsonOne(query) }));
      const manys = Object.entries(includeMany ?? {}).map(([key, query]) => ({ key, charm: jsonMany(query) }));
      const hooks: SqlSelectHooks | undefined = ones.length || manys.length
         ? {
              afterSelect: [...ones, ...manys].map(({ key, charm }) => charm.as(key)),
              afterFrom: [],
           }
         : undefined;
      super(table, baseArgs as Args, info({ driver: "duckdb" }), undefined, undefined, hooks);
   }

   protected override createProjectionNode(fieldNames: string[]): Sql {
      return new DuckDBProjectBy<SqlProjectByParams<T>>(this.table as SqlTableAny, "select", fieldNames);
   }

   protected override createIncludes(): { afterSelect: Sql[]; afterFrom: Sql[] } | null {
      return null;
   }

   execute(): DuckDBSelectCommandResult<T, Args> {
      return this.build().duckdb as DuckDBSelectCommandResult<T, Args>;
   }
}
