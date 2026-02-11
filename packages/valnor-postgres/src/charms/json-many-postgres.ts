import {
   Sql,
   sql,
   SqlBuildError,
   SqlBuildOptions,
   SqlQuery,
   SqlBuildContext,
   quote,
   raw,
   SqlCharm,
   SqlSelectCharm,
   JsonRow,
} from "valnor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonAggPostgresAny = JsonManyPostgres<any>;

/**
 * Sql class that aggregates of a subquery into a JSON array
 * @example
 * SELECT ${Account.$$all}, ${jsonAgg(UserOrders)} "orders"
 * FROM ${Account} ${jsonAgg(UserOrders)}
 * WHERE ${Account.$accountId} = ${param("accountId")}
 */
export class JsonManyPostgres<T extends { Row?: unknown; Params?: unknown }> extends SqlCharm<{ Params: T["Params"] }> {
   constructor(public readonly query: SqlQuery<T>) {
      super({ ID: query.ID, params: query.params });
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
            context.addStrings(`"${queryName}_result"`);
            break;
         case "from": {
            context.addStrings("left join lateral (");
            const query = sql`
               select coalesce(jsonb_agg(${raw(queryName)}.${this.query.$$}), '[]') as ${raw(`${queryName}_result`)}
               from ${this.query}) as ${raw(queryName)}
               on true
            `;
            context.scope({ query });
            query.build(context, options);
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
   as<Key extends string>(key: Key): SqlSelectCharm<{ Key: Key; Type: JsonRow<T["Row"]>[] }> {
      const query = this.query;
      return new SqlSelectCharm<{ Key: Key; Type: JsonRow<T["Row"]>[] }>({
         key,
         build(context: SqlBuildContext) {
            context.scope({ query }, () => {
               const queryName = context.getQueryName(query);
               context.addStrings(`"${queryName}_result" as ${quote(this.key)}`);
            });
         },
      });
   }
}

/**
 * Creates a new SelectJsonAgg (Sql) object core block.
 * @param query sql core to aggregate
 * @returns SelectJsonAgg (Sql) object core block
 * @example
 * SELECT ${Account.$$all}, ${jsonAgg(UserOrders)} "orders"
 * FROM ${Account} ${jsonAgg(UserOrders)}
 * WHERE ${Account.$accountId} = ${param("accountId")}
 * */
export function jsonMany<T extends { Row?: unknown; Params?: unknown }>(query: SqlQuery<T>): JsonManyPostgres<T> {
   return new JsonManyPostgres(query);
}
