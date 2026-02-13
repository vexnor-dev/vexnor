import {
   raw,
   sql,
   SqlBuildContext,
   SqlBuildOptions,
   SqlCharm,
   SqlQuery,
   SqlQueryName,
   SqlSelectCharm,
   SqlSelectColumn,
   SqlSelectValue,
} from "valnor";

/**
 * SQL class that aggregates a subquery into a JSON array for SQLite
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
export class JsonManySqlite3<T extends { Params?: unknown; Row?: unknown }> extends SqlCharm<{
   Params: T["Params"];
}> {
   constructor(public readonly query: SqlQuery<T>) {
      super({
         ID: query.ID,
         params: query.params,
      });
   }

   build(context: SqlBuildContext, options: SqlBuildOptions) {
      switch (context.keyword) {
         case "select": {
            const queryName = context.scope({ query: this.query }, () => {
               return context.getQueryName(this.query);
            });

            // Build the full correlated subquery.
            // This structure ensures that if the sub-select has an ORDER BY,
            // the rows are sorted *before* being passed to json_group_array.
            context.addStrings("(");
            const query = sql`
               select coalesce(json_group_array(json_object(${raw(queryName)}.${this.query.$$})), '[]')
               from ${this.query}`;
            context.scope({ query });
            query.build(context, options);
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

   as<Key extends string>(key: Key): SqlSelectCharm<{ Key: Key; Type: string; Params: T["Params"] }> {
      const query = this.query;
      const queryName = new SqlQueryName(this.query);
      return new SqlSelectCharm<{ Key: Key; Type: string; Params: T["Params"] }>({
         key,
         params: this.params,
         build(context, options) {
            const fields = Object.values(query.row ?? {}).flatMap((value) => {
               if (value instanceof SqlSelectValue || value instanceof SqlSelectColumn) {
                  return [raw(`'${value.key}'`, { quote: false }), raw(value.key)];
               }
            });
            sql`(
            select coalesce(json_group_array(json_object(${fields})), '[]')
            from (${query.render("sql")}) as ${queryName}) as ${raw(key)}`.build(context, options);
         },
      });
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
export function jsonMany<T extends { Row?: unknown; Params?: unknown }>(select: SqlQuery<T>): JsonManySqlite3<T> {
   return new JsonManySqlite3(select);
}
