// noinspection SqlNoDataSourceInspection,SqlResolve
import {
   Sql,
   SqlTable,
   SqlTableAny,
   SqlSelectCommand,
   SqlSelectArgs,
   ParamsOfArgs,
   SqlSelectResultRow,
   info,
   SqlQueryColumns,
   SqlQueryBaseAny,
} from "@vexnor/core";
import { jsonMany, jsonOne } from "#src/charms/json-aggregation-mssql.js";
import { MssqlQueryHandler } from "#src/mssql-query-handler.js";
import { MssqlOrderBy } from "#src/crud/mssql-order-by.js";
import { MssqlPagination } from "#src/crud/mssql-pagination.js";
import "#src/mssql-augment.js";

export type MssqlSelectCommandResult<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs<T>,
> = MssqlQueryHandler<{
   Row: SqlSelectResultRow<T, Args>;
   Params: ParamsOfArgs<Args>;
}> &
   SqlQueryColumns<SqlSelectResultRow<T, Args>>;

/**
 * MSSQL-specific select command.
 *
 * Extends `SqlSelectCommand` to:
 * - Handle `includeOne`/`includeMany` via MSSQL JSON aggregation (OUTER APPLY + FOR JSON)
 * - Add an unordered fallback for OFFSET/FETCH when no runtime order is provided
 * - Use `MssqlPagination` (OFFSET/FETCH) instead of the default `SqlPagination`
 * - Tag queries with `info({ driver: 'transactsql' })`
 * - Return the `.mssql` handler
 */
export class MssqlSelectCommand<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs<T>,
   M extends Record<string, SqlTableAny> = Record<string, never>,
> extends SqlSelectCommand<T, Args, M> {
   private readonly includeOneArg: Record<string, SqlQueryBaseAny> | undefined;
   private readonly includeManyArg: Record<string, SqlQueryBaseAny> | undefined;

   constructor(table: SqlTable<T>, args: Args, joinMap?: M) {
      const { includeOne, includeMany, ...baseArgs } = args;

      super(table, baseArgs as Args, info({ driver: "transactsql" }), joinMap, undefined, undefined);

      this.includeOneArg = includeOne;
      this.includeManyArg = includeMany;
   }

   protected override createPaginationNode(): Sql {
      return new MssqlPagination();
   }

   protected override createOrderByNode(fieldNames: string[]): Sql {
      return new MssqlOrderBy(this.table as SqlTableAny, {
         paramName: "orderBy",
         fieldNames,
         selectParamName: "select",
      });
   }

   protected override createIncludes(): { afterSelect: Sql[]; afterFrom: Sql[] } | null {
      const ones = Object.entries(this.includeOneArg ?? {}).map(([k, q]) => ({
         key: k,
         charm: jsonOne(q.source),
      }));
      const manys = Object.entries(this.includeManyArg ?? {}).map(([k, q]) => ({
         key: k,
         charm: jsonMany(q.source),
      }));

      if (!ones.length && !manys.length) return null;

      return {
         afterSelect: [...ones.map(({ key, charm }) => charm.as(key)), ...manys.map(({ key, charm }) => charm.as(key))],
         afterFrom: [...ones.map(({ charm }) => charm), ...manys.map(({ charm }) => charm)],
      };
   }

   /**
    * Builds the query and returns the `.mssql` handler with full type inference.
    */
   execute(): MssqlSelectCommandResult<T, Args> {
      return this.build().mssql as MssqlSelectCommandResult<T, Args>;
   }
}
