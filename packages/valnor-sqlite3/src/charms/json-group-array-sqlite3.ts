import { Sql, sql, SqlBuildOptions, SqlQueryAny, SqlBuildContext } from "valnor";

/**
 * Sql class that aggregates a subquery into a JSON array for SQLite
 * Uses json_group_array for aggregation.
 * @example
 *
 * Orders by accountId:
 * SELECT ${Orders.$$all}
 * FROM ${Orders}
 * WHERE ${Orders.accountId} = ${Account.$accountId}
 * LIMIT ${param("limit")}
 *
 * Accounts and their orders:
 * SELECT ${Account.$$all}, ${jsonAgg(AccountOrders)} "orders"
 * FROM ${Account} ${jsonAgg(AccountOrders)}
 * WHERE ${Account.$accountId} = ${param("accountId")}
 */
export class JsonGroupArraySqlite3 extends Sql {
   constructor(public readonly select: SqlQueryAny) {
      super();
   }

   build(context: SqlBuildContext, options: SqlBuildOptions) {
      switch (context.keyword) {
         case "select": {
            // Build the full correlated subquery.
            // This structure ensures that if the sub-select has an ORDER BY,
            // the rows are sorted *before* being passed to json_group_array.
            context.addStrings("(");
            const subquery = sql<object>`
               select coalesce(json_group_array(json_object(${this.select.row.$$all})), '[]')
               from ${this.select}`;
            subquery.build(context.trackQuery({ queryName: this.select.name }), options);
            context.addStrings(")");
            break;
         }
         case "from":
            // A correlated subquery in the SELECT list does not add anything to the FROM clause.
            // This case now does nothing, which is the correct behavior.
            return;
         default:
            // Corrected the error message to reflect the function name.
            throw new TypeError(`Cannot use jsonGroupArray() with SQL keyword: ${context.keyword}`);
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
 * WHERE ${Orders.accountId} = ${Account.$accountId}
 * LIMIT ${param("limit")}
 *
 * Accounts and their orders:
 * SELECT ${Account.$$all}, ${jsonAgg(AccountOrders)} "orders"
 * FROM ${Account} ${jsonAgg(AccountOrders)}
 * WHERE ${Account.$accountId} = ${param("accountId")}
 */
export function jsonGroupArray(select: SqlQueryAny) {
   return new JsonGroupArraySqlite3(select);
}
