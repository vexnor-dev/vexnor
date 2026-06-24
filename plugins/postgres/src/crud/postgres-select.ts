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
   SqlFilterBy,
   SqlFilterParams,
} from "@vexnor/core";
import { jsonMany, jsonOne } from "#/charms/json-aggregation-postgres.js";
import { PostgresQueryHandler } from "#/postgres-query-handler.js";
import "#/postgres-augment.js";

export type PostgresSelectResult<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs<T>,
> = PostgresQueryHandler<{
   Row: SqlSelectResultRow<T, Args>;
   Params: ParamsOfArgs<Args> & SqlFilterParams<T, "filterBy">;
}> &
   SqlQueryColumns<SqlSelectResultRow<T, Args>>;

export function postgresSelect<T extends { Select: Record<string, unknown> }, Args extends SqlSelectArgs<T>>(
   table: SqlTable<T>,
   args: Args,
): PostgresSelectResult<T, Args> {
   const { offset, limit, includeOne, includeMany, ...baseArgs } = args;

   if (!includeOne && !includeMany && !offset && !limit) {
      return sqlSelect(table, baseArgs as Args).postgres as PostgresSelectResult<T, Args>;
   }

   if (offset || limit) {
      if (!args.ORDER_BY) throw new Error("ORDER_BY is required when using offset/limit");
   }

   const ones = Object.entries(includeOne ?? {}).map(([k, q]) => ({ key: k, charm: jsonOne(q as SqlQueryBaseAny) }));
   const manys = Object.entries(includeMany ?? {}).map(([k, q]) => ({ key: k, charm: jsonMany(q as SqlQueryBaseAny) }));

   const includes = [...ones, ...manys].map(({ key, charm }) => charm.as(key));

   const userWhere = baseArgs.WHERE?.source.inline();
   const filterNode = userWhere
      ? new SqlFilterBy<T, "filterBy">(table, { paramName: "filterBy", suffix: " and" })
      : new SqlFilterBy<T, "filterBy">(table, { paramName: "filterBy", prefix: "where " });
   const whereFragment = userWhere
      ? sql`where ${filterNode} ${userWhere}`.inline("default")
      : sql`${filterNode}`.inline("default");

   const result = sql`
      ${info({ driver: "postgres" })}
      select ${args.SELECT ? args.SELECT.source.inline("default") : row(table.$$)}
                ${includes.length > 0 ? raw(", ") : raw.BLANK} ${includes}
      from ${table} ${ones.map(({ charm }) => charm)} ${manys.map(({ charm }) => charm)} ${baseArgs.JOIN ? baseArgs.JOIN.source.inline() : raw.BLANK}
         ${whereFragment}
         ${baseArgs.GROUP_BY ? sql`group by ${baseArgs.GROUP_BY.source.inline()}`.inline("default") : raw.BLANK}
         ${baseArgs.HAVING ? sql`having ${baseArgs.HAVING.source.inline()}`.inline("default") : raw.BLANK}
         ${baseArgs.ORDER_BY ? sql`order by ${baseArgs.ORDER_BY.source.inline()}`.inline("default") : raw.BLANK}
         ${limit ? sql`limit ${limit}`.inline("default") : raw.BLANK}
         ${offset ? sql`offset ${offset}`.inline("default") : raw.BLANK}
   `.postgres;
   return result as PostgresSelectResult<T, Args>;
}
