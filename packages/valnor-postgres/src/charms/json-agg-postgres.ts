import {
   raw,
   Sql,
   sql,
   SqlBuildError,
   SqlBuildOptions,
   SqlCharm,
   SqlQuery,
   SqlQueryAny,
   SqlBuildContext,
} from "valnor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonAggPostgresAny = JsonAggPostgres<any>;

/**
 * Sql class that aggregates of a subquery into a JSON array
 * @example
 * SELECT ${Account.$$all}, ${jsonAgg(UserOrders)} "orders"
 * FROM ${Account} ${jsonAgg(UserOrders)}
 * WHERE ${Account.$accountId} = ${param("accountId")}
 */
export class JsonAggPostgres<T extends { Row: Record<string, unknown>; Params?: unknown }>
   extends Sql
   implements SqlCharm<T>
{
   constructor(public readonly query: SqlQuery<T>) {
      super({ ID: "JsonAggPostgres" });
   }

   build(context: SqlBuildContext, options: SqlBuildOptions) {
      if (!this.query.row) {
         throw new SqlBuildError(`query row is required for json aggregation`);
      }

      switch (context.keyword) {
         case "select":
            context.addStrings(`"${this.query.ID}_result"`);
            break;
         case "from": {
            const result = raw(this.query.ID + "_result");
            context.addStrings("left join lateral (");
            sql`
               select coalesce(jsonb_agg(${this.query.row.$$}), '[]') as "${result}"
               from ${this.query}) as "${raw(this.query.ID)}"
               on true
            `.build(context.trackQuery(this.query), options);
            break;
         }
         default:
            throw new TypeError(`Cannot use jsonAgg() with SQL keyword: ${context.keyword}`);
      }
   }
}

/**
 * Creates a new SelectJsonAgg (Sql) object core block.
 * @param select sql core to aggregate
 * @returns SelectJsonAgg (Sql) object core block
 * @example
 * SELECT ${Account.$$all}, ${jsonAgg(UserOrders)} "orders"
 * FROM ${Account} ${jsonAgg(UserOrders)}
 * WHERE ${Account.$accountId} = ${param("accountId")}
 * */
export function jsonAgg<T extends { Row: Record<string, unknown>; Params?: unknown }>(
   select: SqlQuery<T>,
): JsonAggPostgres<T> {
   if (!cache.has(select)) {
      const result = new JsonAggPostgres(select);
      cache.set(select, result);
   }

   return cache.get(select)!;
}

const cache = new WeakMap<SqlQueryAny, JsonAggPostgresAny>();
