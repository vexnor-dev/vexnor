import { Sql, SqlBuildOptions, SqlQueryAny, SqlBuildContext } from "valnor";

/**
 * Sql class that aggregates of a subquery into a JSON array
 * @example
 * SELECT ${Account.$$all}, ${jsonAgg(UserOrders)} "orders"
 * FROM ${Account} ${jsonAgg(UserOrders)}
 * WHERE ${Account.$accountId} = ${param("accountId")}
 */
export class JsonAggMssql extends Sql {
   constructor(public readonly query: SqlQueryAny) {
      super();
   }

   build(context: SqlBuildContext, options: SqlBuildOptions) {
      switch (context.keyword) {
         case "select":
            context.addStrings(`"${this.query.name}_result"."${this.query.name}"`);
            break;
         case "from": {
            context.addStrings("outer apply (\nselect coalesce((\n");
            this.query.build(context.scope({ queryName: this.query.info?.label }), options);
            context.addStrings(
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
 * WHERE ${Account.$accountId} = ${param("accountId")}
 * */
export function jsonAgg(query: SqlQueryAny) {
   if (!cache.has(query)) {
      const result = new JsonAggMssql(query);
      cache.set(query, result);
   }

   return cache.get(query)!;
}

const cache = new WeakMap<SqlQueryAny, JsonAggMssql>();
