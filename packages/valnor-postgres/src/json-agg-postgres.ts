import { raw, Sql, sql, SqlBuildOptions, SqlQueryAny, SqlQueryContext } from "valnor";

/**
 * Sql class that aggregates of a subquery into a JSON array
 * @example
 * SELECT ${Account.$$all}, ${jsonAgg(UserOrders)} "orders"
 * FROM ${Account} ${jsonAgg(UserOrders)}
 * WHERE ${Account.accountId} = ${param("accountId")}
 */
export class JsonAggPostgres extends Sql {
   constructor(public readonly select: SqlQueryAny) {
      super();
   }

   build(context: SqlQueryContext, options: SqlBuildOptions) {
      switch (context.keyword) {
         case "select":
            context.strings.push(`"${this.select.name}_result"`);
            break;
         case "from": {
            const result = raw(this.select.name + "_result");
            context.strings.push("left join lateral (");
            const join = sql`
               select coalesce(jsonb_agg(${this.select.ROW.$$all}), '[]') as "${result}"
               from ${this.select}) as "${raw(this.select.name)}"
               on true`;

            join.build(context.child({ queryName: this.select.name }), options);
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
 * WHERE ${Account.accountId} = ${param("accountId")}
 * */
export function jsonAgg(select: SqlQueryAny) {
   if (!cache.has(select)) {
      const result = new JsonAggPostgres(select);
      cache.set(select, result);
   }

   return cache.get(select)!;
}

const cache = new WeakMap<SqlQueryAny, JsonAggPostgres>();
