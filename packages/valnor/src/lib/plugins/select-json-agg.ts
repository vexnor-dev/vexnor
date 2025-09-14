import { Sql } from "../sql-base.js";
import { SqlQueryContext } from "../sql-query-context.js";
import { SqlQueryAny } from "../sql-query.js";
import { raw } from "../sql-raw.js";
import { sql } from "../sql.js";

/**
 * Sql class that aggregation of a subquery into a JSON array
 * @example
 * SELECT ${Account.$$all},
 *           ${jsonAgg(UserOrders)} "orders"
 *    FROM ${Account} ${jsonAgg(UserOrders)}
 *    WHERE ${Account.accountId} = ${newAccount.accountId}
 */
export class SelectJsonAgg extends Sql {
   constructor(public readonly select: SqlQueryAny) {
      super();
   }

   build(context: SqlQueryContext) {
      switch (context.keyword) {
         case "select":
            context.strings.push(`"${this.select.name}_result"`);
            break;
         case "from": {
            const newContext = new SqlQueryContext({ queryName: this.select.name });
            const result = raw(this.select.name + "_result");
            const join = sql`
              select coalesce(jsonb_agg(${this.select.ROW.$$all}), '[]') as "${result}" 
               from ${this.select}) as "${raw(this.select.name)}" on true`;

            join.build(newContext);

            context.strings.push("left join lateral (", ...newContext.strings);
            context.values.push(...newContext.values);
            break;
         }
         default:
            throw new TypeError(`Cannot use jsonAgg() with SQL keyword: ${context.keyword}`);
      }
   }
}

/**
 * Creates a new SelectJsonAgg (Sql) object query block.
 * @param select sql query to aggregate
 * @returns SelectJsonAgg (Sql) object query block
 * @example
 * SELECT ${Account.$$all},
 *           ${jsonAgg(UserOrders)} "orders"
 *    FROM ${Account} ${jsonAgg(UserOrders)}
 *    WHERE ${Account.accountId} = ${newAccount.accountId}
 */
export function jsonAgg(select: SqlQueryAny) {
   if (!cache.has(select)) {
      const result = new SelectJsonAgg(select);
      cache.set(select, result);
   }

   return cache.get(select)!;
}

const cache = new WeakMap<SqlQueryAny, SelectJsonAgg>();
