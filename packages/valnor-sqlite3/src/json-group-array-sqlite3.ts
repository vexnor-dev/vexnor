import { raw, Sql, sql, SqlBuildOptions, SqlQueryAny, SqlQueryContext } from "valnor";

/**
 * Sql class that aggregates a subquery into a JSON array for SQLite
 * Uses json_group_array for aggregation.
 * @example
 *
 * Orders by accountId:
 * SELECT ${Orders.$$all}
 * FROM ${Orders}
 * WHERE ${Orders.accountId} = ${Account.accountId}
 * LIMIT ${param("limit")}
 *
 * Accounts and their orders:
 * SELECT ${Account.$$all}, ${jsonAgg(AccountOrders)} "orders"
 * FROM ${Account} ${jsonAgg(AccountOrders)}
 * WHERE ${Account.accountId} = ${param("accountId")}
 */
export class JsonGroupArraySqlite3 extends Sql {
   constructor(public readonly select: SqlQueryAny) {
      super();
   }

   build(context: SqlQueryContext, options: SqlBuildOptions) {
      switch (context.keyword) {
         case "select":
            context.strings.push(`"${this.select.name}_result"`);
            break;
         case "from": {
            // Pass the tokenizer from the parent context to the new sub-context
            const result = raw(this.select.name + "_result");
            context.strings.push("left join lateral (");
            // Use raw SQL for json_group_array and json
            const join = sql`
               select coalesce(json_group_array(json_object(${this.select.ROW.$$all})), '[]') as "${result}"
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
 * Creates a new SelectJsonAggSqlite (Sql) object core block for SQLite
 * @param select sql core to aggregate
 * @returns SelectJsonAggSqlite (Sql) object core block
 * @example
 *
 * Orders by accountId:
 * SELECT ${Orders.$$all}
 * FROM ${Orders}
 * WHERE ${Orders.accountId} = ${Account.accountId}
 * LIMIT ${param("limit")}
 *
 * Accounts and their orders:
 * SELECT ${Account.$$all}, ${jsonAgg(AccountOrders)} "orders"
 * FROM ${Account} ${jsonAgg(AccountOrders)}
 * WHERE ${Account.accountId} = ${param("accountId")}
 */
export function jsonGroupArray(select: SqlQueryAny) {
   return new JsonGroupArraySqlite3(select);
}
