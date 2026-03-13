import {
   sql,
   raw,
   row,
   SqlTable,
   sqlSelect,
   SqlSelectArgs,
   ParamsOfArgs,
   SqlQueryExtended,
   SqlSelectResultRow,
   info,
} from "valnor";
import { jsonMany, jsonOne } from "#/charms/json-aggregation-sqlite3.js";
import { BetterSqlite3QueryHandler } from "#/better-sqlite3-query-handler.js";
import "#/valnor-sqlite3.js";

export type Sqlite3SelectResult<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs,
> = BetterSqlite3QueryHandler<{
   Row: SqlSelectResultRow<T, Args>;
   Params: ParamsOfArgs<Args>;
}> &
   SqlQueryExtended<{ Row: SqlSelectResultRow<T, Args>; Params: ParamsOfArgs<Args> }>;

export function sqlite3Select<T extends { Select: Record<string, unknown> }, Args extends SqlSelectArgs>(
   table: SqlTable<T>,
   args: Args,
): Sqlite3SelectResult<T, Args> {
   const { offset, limit, includeOne, includeMany, ...baseArgs } = args;

   if (!includeOne && !includeMany && !offset && !limit) {
      return sqlSelect(table, baseArgs as Args).sqlite3 as Sqlite3SelectResult<T, Args>;
   }

   if (offset || limit) {
      if (!args.ORDER_BY) throw new Error("ORDER_BY is required when using offset/limit");
   }

   const ones = Object.entries(includeOne ?? {}).map(([k, q]) => ({ key: k, charm: jsonOne(q!) }));
   const manys = Object.entries(includeMany ?? {}).map(([k, q]) => ({ key: k, charm: jsonMany(q!) }));

   const includes = [...ones, ...manys].map(({ key, charm }) => charm.as(key));

   return sql`
      ${info({ driver: "sqlite" }) ?? raw.BLANK}
      select ${args.SELECT?.$$ ? row(args.SELECT.$$) : row(table.$$)}
                ${includes.length > 0 ? raw(", ") : raw.BLANK} ${includes}
      from ${table} ${baseArgs.JOIN ? baseArgs.JOIN.inline() : raw.BLANK}
         ${baseArgs.WHERE ? sql`where ${baseArgs.WHERE.inline()}`.inline("default") : raw.BLANK}
         ${baseArgs.GROUP_BY ? sql`group by ${baseArgs.GROUP_BY.inline()}`.inline("default") : raw.BLANK}
         ${baseArgs.HAVING ? sql`having ${baseArgs.HAVING.inline()}`.inline("default") : raw.BLANK}
         ${baseArgs.ORDER_BY ? sql`order by ${baseArgs.ORDER_BY.inline()}`.inline("default") : raw.BLANK}
         ${limit ? sql`limit ${limit}`.inline("default") : raw.BLANK}
         ${offset ? sql`offset ${offset}`.inline("default") : raw.BLANK}
   `.sqlite3 as Sqlite3SelectResult<T, Args>;
}
