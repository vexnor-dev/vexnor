// noinspection SqlNoDataSourceInspection,SqlResolve
import {
   SqlTable,
   sqlSelect,
   SqlSelectArgs,
   ParamsOfArgs,
   SqlSelectResultRow,
   info,
   SqlQueryColumns,
   SqlQueryBaseAny,
   SqlWindowByParams,
} from "@vexnor/core";
import { jsonMany, jsonOne } from "#src/charms/json-aggregation-mssql.js";
import { MssqlQueryHandler } from "#src/mssql-query-handler.js";
import { MssqlPagination } from "#src/crud/mssql-pagination.js";
import "#src/mssql-augment.js";

export type MssqlSelectResult<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs<T>,
> = MssqlQueryHandler<{
   Row: SqlSelectResultRow<T, Args>;
   Params: ParamsOfArgs<Args> & SqlWindowByParams;
}> &
   SqlQueryColumns<SqlSelectResultRow<T, Args>>;

export function mssqlSelect<T extends { Select: Record<string, unknown> }, Args extends SqlSelectArgs<T>>(
   table: SqlTable<T>,
   args: Args,
): MssqlSelectResult<T, Args> {
   const { includeOne, includeMany, ...baseArgs } = args;

   const ones = Object.entries(includeOne ?? {}).map(([k, q]) => ({ key: k, charm: jsonOne((q as SqlQueryBaseAny).source) }));
   const manys = Object.entries(includeMany ?? {}).map(([k, q]) => ({ key: k, charm: jsonMany((q as SqlQueryBaseAny).source) }));

   const hooks = {
      ...(ones.length || manys.length) ? {
         afterSelect: [...ones, ...manys].map(({ key, charm }) => charm.as(key)),
         afterFrom: [...ones.map(({ charm }) => charm), ...manys.map(({ charm }) => charm)],
      } : {},
      pagination: new MssqlPagination(),
   };

   return sqlSelect(table, baseArgs as Args, info({ driver: "transactsql" }), undefined, undefined, hooks).mssql as MssqlSelectResult<T, Args>;
}
