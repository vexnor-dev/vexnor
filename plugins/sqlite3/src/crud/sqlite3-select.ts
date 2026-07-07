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
import { jsonMany, jsonOne } from "#src/charms/json-aggregation-sqlite3.js";
import { BetterSqlite3QueryHandler } from "#src/better-sqlite3-query-handler.js";
import "#src/sqlite3-augment.js";

export type Sqlite3SelectResult<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs<T>,
> = BetterSqlite3QueryHandler<{
   Row: SqlSelectResultRow<T, Args>;
   Params: (ParamsOfArgs<Args> extends void ? unknown : ParamsOfArgs<Args>) & SqlWindowByParams<T>;
}> &
   SqlQueryColumns<SqlSelectResultRow<T, Args>>;

export function sqlite3Select<T extends { Select: Record<string, unknown> }, Args extends SqlSelectArgs<T>>(
   table: SqlTable<T>,
   args: Args,
): Sqlite3SelectResult<T, Args> {
   const { includeOne, includeMany, ...baseArgs } = args;

   const ones = Object.entries(includeOne ?? {}).map(([k, q]) => ({ key: k, charm: jsonOne((q as SqlQueryBaseAny).source) }));
   const manys = Object.entries(includeMany ?? {}).map(([k, q]) => ({ key: k, charm: jsonMany((q as SqlQueryBaseAny).source) }));

   const hooks = (ones.length || manys.length) ? {
      afterSelect: [...ones, ...manys].map(({ key, charm }) => charm.as(key)),
   } : undefined;

   return sqlSelect(table, baseArgs as Args, info({ driver: "sqlite" }), undefined, undefined, hooks).sqlite as Sqlite3SelectResult<T, Args>;
}
