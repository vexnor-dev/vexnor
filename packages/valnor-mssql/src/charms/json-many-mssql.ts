import {
   Sql,
   SqlBuildOptions,
   SqlBuildContext,
   SqlQuery,
   quote,
   SqlBuildError,
   PARAMS,
   SqlCharm,
   SqlSelectCharm,
   sql,
   raw,
} from "valnor";

/**
 * SQL class that aggregates of a subquery into a JSON array
 * @example
 * SELECT ${Account.$$all}, ${jsonAgg(UserOrders)} "orders"
 * FROM ${Account} ${jsonAgg(UserOrders)}
 * WHERE ${Account.$accountId} = ${param("accountId")}
 */
export class JsonManyMssql<T extends { Row?: unknown; Params?: unknown }> extends SqlCharm<{ Params: T["Params"] }> {
   declare readonly [PARAMS]: T["Params"];

   constructor(public readonly query: SqlQuery<T>) {
      super({
         id: `json_agg(${query.id})`,
         params: query.params,
      });
   }

   build(context: SqlBuildContext, options: SqlBuildOptions) {
      if (!this.query.row) {
         throw new SqlBuildError(`query row is required for json aggregation`);
      }

      const queryName = context.scope({ query: this.query }, () => {
         return context.getQueryName(this.query);
      });
      switch (context.keyword) {
         case "select":
            context.addStrings(`"${queryName}_result"."${queryName}"`);
            break;
         case "from": {
            const query = sql`
               outer apply (
               select coalesce((${this.query.render({ format: "sql" })} for json path, include_null_values), '[]')
                  as ${raw(queryName)}) as ${raw(`${queryName}_result`)}`;

            context.scope({ query, inline: true }, () => {
               query.build(context, options);
            });
            break;
         }
         default:
            throw new TypeError(`Cannot use jsonAgg() with SQL keyword: ${context.keyword}`);
      }
   }

   /**
    * Returns a SqlSelectValue with the specified key.
    * @param key
    */
   as<Key extends string>(key: Key): SqlSelectCharm<{ Key: Key; Type: string }> {
      const query = this.query;
      return new SqlSelectCharm<{ Key: Key; Type: string }>({
         key,
         build(context: SqlBuildContext) {
            const queryName = context.getQueryName(query);
            context.addStrings(`"${queryName}_result"."${queryName}" as ${quote(this.key)}`);
         },
      });
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
export function jsonMany<T extends { Row?: unknown; Params?: unknown }>(query: SqlQuery<T>): JsonManyMssql<T> {
   return new JsonManyMssql(query);
}
