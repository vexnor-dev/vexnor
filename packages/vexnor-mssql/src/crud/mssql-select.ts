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
} from "vexnor";
import { jsonMany, jsonOne } from "#/charms/json-aggregation-mssql.js";
import { MssqlQueryHandler } from "#/mssql-query-handler.js";

export type MssqlSelectResult<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs,
> = MssqlQueryHandler<{
   Row: SqlSelectResultRow<T, Args>;
   Params: ParamsOfArgs<Args>;
}> &
   SqlQueryExtended<{ Row: SqlSelectResultRow<T, Args>; Params: ParamsOfArgs<Args> }>;

export function mssqlSelect<T extends { Select: Record<string, unknown> }, Args extends SqlSelectArgs>(
   table: SqlTable<T>,
   args: Args,
): MssqlSelectResult<T, Args> {
   const { offset, limit, includeOne, includeMany, ...baseArgs } = args;

   if (!includeOne && !includeMany && !offset && !limit) {
      return sqlSelect(table, baseArgs as Args).mssql as MssqlSelectResult<T, Args>;
   }

   if (offset || limit) {
      if (!args.ORDER_BY) throw new Error("ORDER_BY is required when using offset/limit");
   }

   const ones = Object.entries(includeOne ?? {}).map(([k, q]) => ({ key: k, charm: jsonOne(q!) }));
   const manys = Object.entries(includeMany ?? {}).map(([k, q]) => ({ key: k, charm: jsonMany(q!) }));

   const includes = [...ones, ...manys].map(({ key, charm }) => charm.as(key));

   const result = sql`
      ${info({ driver: "transactsql" }) ?? raw.BLANK}
      select ${args.SELECT?.$$ ? row(args.SELECT.$$) : row(table.$$)}
                ${includes.length > 0 ? raw(", ") : raw.BLANK} ${includes}
      from ${table} ${ones.map(({ charm }) => charm)} ${manys.map(({ charm }) => charm)} ${baseArgs.JOIN ? baseArgs.JOIN.inline() : raw.BLANK}
         ${baseArgs.WHERE ? sql`where ${baseArgs.WHERE.inline()}`.inline("default") : raw.BLANK}
         ${baseArgs.GROUP_BY ? sql`group by ${baseArgs.GROUP_BY.inline()}`.inline("default") : raw.BLANK}
         ${baseArgs.HAVING ? sql`having ${baseArgs.HAVING.inline()}`.inline("default") : raw.BLANK}
         ${baseArgs.ORDER_BY ? sql`order by ${baseArgs.ORDER_BY.inline()}`.inline("default") : raw.BLANK}
         ${offset ? sql`offset ${offset} rows`.inline("default") : raw.BLANK}
         ${limit ? sql`fetch next ${limit} rows only`.inline("default") : raw.BLANK}
   `.mssql;
   return result as MssqlSelectResult<T, Args>;
}
