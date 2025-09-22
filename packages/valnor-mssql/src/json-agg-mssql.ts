import { raw, Sql, sql, SqlBuildOptions, SqlQueryAny, SqlQueryContext } from "valnor";

/**
 * Sql class that aggregates of a subquery into a JSON array
 * @example
 * SELECT ${Account.$$all}, ${jsonAgg(UserOrders)} "orders"
 * FROM ${Account} ${jsonAgg(UserOrders)}
 * WHERE ${Account.accountId} = ${param("accountId")}
 */
export class JsonAggMssql extends Sql {
   constructor(public readonly select: SqlQueryAny) {
      super();
   }

   build(context: SqlQueryContext, options: SqlBuildOptions) {
      switch (context.keyword) {
         case "select":
            context.strings.push(`"${this.select.name}_result"`);
            break;
         case "from": {
            const newContext = new SqlQueryContext({ queryName: this.select.name });
            const result = raw(this.select.name + "_result");
            const join = sql`
               select ISNULL((
                  select ${this.select.ROW.$$all}
                  from ${this.select}
                  FOR JSON PATH
               ), '[]') as "${result}"`;

            join.build(newContext, options);

            context.strings.push("cross apply (", ...newContext.strings, ") as " + this.select.name);
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
 * SELECT ${Account.$$all}, ${jsonAgg(UserOrders)} "orders"
 * FROM ${Account} ${jsonAgg(UserOrders)}
 * WHERE ${Account.accountId} = ${param("accountId")}
 * */
export function jsonAgg(select: SqlQueryAny) {
   if (!cache.has(select)) {
      const result = new JsonAggMssql(select);
      cache.set(select, result);
   }

   return cache.get(select)!;
}

const cache = new WeakMap<SqlQueryAny, JsonAggMssql>();
