import {
   SqlTable,
   sqlSelect,
   SqlSelectArgs,
   ParamsOfArgs,
   SqlSelectResultRow,
   info,
   SqlQueryColumns,
   SqlQueryBaseAny,
   SqlFilterParams,
   SqlOrderByParams,
   SqlPaginationParams,
   SqlProjectByParams,
   SqlHavingByParams,
   SqlWindowByParams,
} from "@vexnor/core";
import { jsonMany, jsonOne } from "#src/charms/json-aggregation-postgres.js";
import { PostgresQueryHandler } from "#src/postgres-query-handler.js";
import "#src/postgres-augment.js";

export type PostgresSelectResult<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs<T>,
> = PostgresQueryHandler<{
   Row: SqlSelectResultRow<T, Args>;
   Params: (ParamsOfArgs<Args> extends void ? unknown : ParamsOfArgs<Args>)
      & SqlFilterParams<T, "filterBy">
      & SqlOrderByParams<T, "orderBy">
      & SqlPaginationParams
      & SqlProjectByParams<T>
      & SqlHavingByParams
      & SqlWindowByParams;
}> &
   SqlQueryColumns<SqlSelectResultRow<T, Args>>;

export function postgresSelect<T extends { Select: Record<string, unknown> }, Args extends SqlSelectArgs<T>>(
   table: SqlTable<T>,
   args: Args,
): PostgresSelectResult<T, Args> {
   const { includeOne, includeMany, ...baseArgs } = args;

   const ones = Object.entries(includeOne ?? {}).map(([k, q]) => ({ key: k, charm: jsonOne(q as SqlQueryBaseAny) }));
   const manys = Object.entries(includeMany ?? {}).map(([k, q]) => ({ key: k, charm: jsonMany(q as SqlQueryBaseAny) }));

   const hooks = (ones.length || manys.length) ? {
      afterSelect: [...ones, ...manys].map(({ key, charm }) => charm.as(key)),
      afterFrom: [...ones.map(({ charm }) => charm), ...manys.map(({ charm }) => charm)],
   } : undefined;

   return sqlSelect(table, baseArgs as Args, info({ driver: "postgres" }), undefined, undefined, hooks).postgres as PostgresSelectResult<T, Args>;
}
