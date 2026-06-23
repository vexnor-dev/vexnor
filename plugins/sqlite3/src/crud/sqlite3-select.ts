import {
   sql,
   raw,
   row,
   SqlTable,
   sqlSelect,
   SqlSelectArgs,
   ParamsOfArgs,
   SqlSelectResultRow,
   info,
   SqlQueryColumns,
   SqlQueryBaseAny,
} from "@vexnor/core";
import { jsonMany, jsonOne } from "#/charms/json-aggregation-sqlite3.js";
import { BetterSqlite3QueryHandler } from "#/better-sqlite3-query-handler.js";
import "#/sqlite3-augment.js";

export type Sqlite3SelectResult<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs<T>,
> = BetterSqlite3QueryHandler<{
   Row: SqlSelectResultRow<T, Args>;
   Params: ParamsOfArgs<Args>;
}> &
   SqlQueryColumns<SqlSelectResultRow<T, Args>>;

export function sqlite3Select<T extends { Select: Record<string, unknown> }, Args extends SqlSelectArgs<T>>(
   table: SqlTable<T>,
   args: Args,
): Sqlite3SelectResult<T, Args> {
   const { offset, limit, includeOne, includeMany, ...baseArgs } = args;

   if (!includeOne && !includeMany && !offset && !limit) {
      return sqlSelect(table, baseArgs as Args).sqlite as Sqlite3SelectResult<T, Args>;
   }

   if (offset || limit) {
      if (!args.ORDER_BY) throw new Error("ORDER_BY is required when using offset/limit");
   }

   const ones = Object.entries(includeOne ?? {}).map(([k, q]) => ({ key: k, charm: jsonOne((q as SqlQueryBaseAny).source) }));
   const manys = Object.entries(includeMany ?? {}).map(([k, q]) => ({ key: k, charm: jsonMany((q as SqlQueryBaseAny).source) }));

   const includes = [...ones, ...manys].map(({ key, charm }) => charm.as(key));

   return sql`
      ${info({ driver: "sqlite" }) ?? raw.BLANK}
      select ${args.SELECT ? args.SELECT.source.inline("default") : row(table.$$)}
                ${includes.length > 0 ? raw(", ") : raw.BLANK} ${includes}
      from ${table} ${baseArgs.JOIN ? baseArgs.JOIN.source.inline() : raw.BLANK}
         ${baseArgs.WHERE ? sql`where ${baseArgs.WHERE.source.inline()}`.inline("default") : raw.BLANK}
         ${baseArgs.GROUP_BY ? sql`group by ${baseArgs.GROUP_BY.source.inline()}`.inline("default") : raw.BLANK}
         ${baseArgs.HAVING ? sql`having ${baseArgs.HAVING.source.inline()}`.inline("default") : raw.BLANK}
         ${baseArgs.ORDER_BY ? sql`order by ${baseArgs.ORDER_BY.source.inline()}`.inline("default") : raw.BLANK}
         ${limit ? sql`limit ${limit}`.inline("default") : raw.BLANK}
         ${offset ? sql`offset ${offset}`.inline("default") : raw.BLANK}
   `.sqlite as Sqlite3SelectResult<T, Args>;
}
