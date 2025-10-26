import { Sql, SqlBuildOptions, SqlQueryAny, SqlQueryContext } from "valnor";

/**
 * Sql class that aggregates of a subquery into a JSON array
 * @example
 * SELECT ${Account.$$all}, ${jsonAgg(UserOrders)} "orders"
 * FROM ${Account} ${jsonAgg(UserOrders)}
 * WHERE ${Account.accountId} = ${param("accountId")}
 */
export class JsonAggMssql extends Sql {
   constructor(public readonly query: SqlQueryAny) {
      super();
   }

   $build(context: SqlQueryContext, options: SqlBuildOptions) {
      switch (context.keyword) {
         case "select":
            context.strings.push(`"${this.query.name}_result"."${this.query.name}"`);
            break;
         case "from": {
            context.strings.push("outer apply (\nselect coalesce((\n");
            this.query.$build(context.child({ queryName: this.query.name }), options);
            context.strings.push(
               `\nfor json path, include_null_values), '[]'\n) as "${this.query.name}")\nas "${this.query.name}_result"`,
            );
            break;
         }
         default:
            throw new TypeError(`Cannot use jsonAgg() with SQL keyword: ${context.keyword}`);
      }
   }
}

/**
 * Creates a new JsonAgg (Sql) object query block.
 * @param query sql query to aggregate
 * @returns SelectJsonAgg (Sql) object query block
 * @example
 * SELECT ${Account.$$all}, ${jsonAgg(UserOrders)} "orders"
 * FROM ${Account} ${jsonAgg(UserOrders)}
 * WHERE ${Account.accountId} = ${param("accountId")}
 * */
export function jsonAgg(query: SqlQueryAny) {
   if (!cache.has(query)) {
      const result = new JsonAggMssql(query);
      cache.set(query, result);
   }

   return cache.get(query)!;
}

const cache = new WeakMap<SqlQueryAny, JsonAggMssql>();
