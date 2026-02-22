import {
   AsyncQueryHandler,
   JsonRow,
   quote,
   raw,
   sql,
   SqlBuildContext,
   SqlBuildError,
   SqlBuildOptions,
   SqlCharm,
   SqlQuery,
   SqlSelectCharm,
} from "valnor";
import { PostgresQueryHandler } from "../postgres-query-handler.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonAggPostgresAny = JsonManyPostgres<any>;

/**
 * SQL class that aggregates of a subquery into a JSON array
 * @example
 * SELECT ${Account.$$all}, ${jsonAgg(UserOrders)} "orders"
 * FROM ${Account} ${jsonAgg(UserOrders)}
 * WHERE ${Account.$accountId} = ${param("accountId")}
 */
export class JsonManyPostgres<T extends { Row?: unknown; Params?: unknown }> extends SqlCharm<Pick<T, "Params">> {
   constructor(public readonly query: SqlQuery<T>) {
      super({
         id: query.id,
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
            context.addStrings(`"${queryName}_result"`);
            break;
         case "from": {
            const query = sql`
               left join lateral (
               select coalesce(jsonb_agg(${this.query.$$}), '[]') as ${raw(`${queryName}_result`)}
               from ${this.query}) as ${raw(queryName)}
               on true
            `;
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
   as<Key extends string>(key: Key): SqlSelectCharm<{ Key: Key; Type: JsonRow<T["Row"]>[] }> {
      const query = this.query;
      return new SqlSelectCharm<{ Key: Key; Type: JsonRow<T["Row"]>[] }>({
         key,
         build(context: SqlBuildContext) {
            const queryName = context.scope({ query }, () => context.getQueryName(query));
            context.addStrings(`"${queryName}_result" as ${quote(this.key)}`);
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
export function jsonMany<T>(query: T): JsonManyPostgresType<T> {
   switch (true) {
      case query instanceof SqlQuery:
         return new JsonManyPostgres(query) as JsonManyPostgresType<T>;
      case query instanceof AsyncQueryHandler:
         return new JsonManyPostgres(query.query) as JsonManyPostgresType<T>;
      default:
         throw new SqlBuildError(`Unexpected arg type: ${query}`);
   }
}

export type JsonManyPostgresType<T> =
   T extends SqlQuery<infer Options extends { Row: Record<string, unknown>; Params?: unknown }>
      ? JsonManyPostgres<Options>
      : T extends PostgresQueryHandler<infer Options>
        ? Options extends {
             Row: Record<string, unknown>;
             Params?: unknown;
          }
           ? JsonManyPostgres<Options>
           : never
        : never;
