import {
   BuildSqlParams,
   info,
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
export type JsonAggregationPostgresAny = JsonAggregationPostgres<any>;

export type JsonResultType = "one" | "many";

/**
 * SQL class that aggregates of a subquery into a JSON array
 * @example
 * SELECT ${Account.$$all}, ${jsonAgg(UserOrders)} "orders"
 * FROM ${Account} ${jsonAgg(UserOrders)}
 * WHERE ${Account.$accountId} = ${param("accountId")}
 */
export class JsonAggregationPostgres<
   T extends { Row?: unknown; Params?: unknown; Type: Array<T["Row"]> | (T["Row"] | null) },
> extends SqlCharm<Pick<T, "Params">> {
   static resultTypes: Record<JsonResultType, { coalesce: string; func: string }> = {
      many: {
         func: "jsonb_agg",
         coalesce: "'[]'",
      },
      one: {
         func: "to_jsonb",
         coalesce: "null",
      },
   };

   readonly type: JsonResultType;

   constructor(
      public readonly query: SqlQuery<Pick<T, "Row" | "Params">>,
      { type }: { type: JsonResultType },
   ) {
      super({
         id: query.id,
         params: query.params,
      });
      this.type = type;
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
            const { coalesce, func } = JsonAggregationPostgres.resultTypes[this.type];
            const query = sql`
                ${info({ inline: true })}
               left join lateral (
               select coalesce(${raw(func, { quote: false })}(${this.query.$$}), ${raw(coalesce, { quote: false })}) as ${raw(`${queryName}_result`)}
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
   as<Key extends string>(key: Key): SqlSelectCharm<{ Key: Key; Type: T["Type"]; Params: T["Params"] }> {
      const query = this.query;
      return new SqlSelectCharm<{ Key: Key; Type: JsonRow<T["Row"]>[]; Params: T["Params"] }>({
         key,
         params: this.params as BuildSqlParams<T["Params"]>,
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
export function jsonMany<T>(query: T): JsonAggregationMany<T> {
   switch (true) {
      case query instanceof PostgresQueryHandler:
         return new JsonAggregationPostgres(query.query, {
            type: "many",
         }) as JsonAggregationMany<T>;
      case query instanceof SqlQuery:
         return new JsonAggregationPostgres(query, {
            type: "many",
         }) as JsonAggregationMany<T>;
      default:
         throw new SqlBuildError(`Unexpected arg type: ${query}`);
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
export function jsonOne<T>(query: T): JsonAggregationOne<T> {
   switch (true) {
      case query instanceof PostgresQueryHandler:
         return new JsonAggregationPostgres(query.query, {
            type: "one",
         }) as JsonAggregationOne<T>;
      case query instanceof SqlQuery:
         return new JsonAggregationPostgres(query, {
            type: "one",
         }) as JsonAggregationOne<T>;
      default:
         throw new SqlBuildError(`Unexpected arg type: ${query}`);
   }
}

export type JsonAggregationOne<T> =
   T extends SqlQuery<infer Options extends { Row: Record<string, unknown>; Params?: unknown }>
      ? JsonAggregationPostgres<{
           Row: Options["Row"];
           Params: Options["Params"];
           Type: JsonRow<Options["Row"]> | null;
        }>
      : T extends PostgresQueryHandler<infer Options>
        ? Options extends {
             Row: Record<string, unknown>;
             Params?: unknown;
          }
           ? JsonAggregationPostgres<{
                Row: Options["Row"];
                Params: Options["Params"];
                Type: JsonRow<Options["Row"]> | null;
             }>
           : never
        : never;

export type JsonAggregationMany<T> =
   T extends SqlQuery<infer Options extends { Row: Record<string, unknown>; Params?: unknown }>
      ? JsonAggregationPostgres<{ Row: Options["Row"]; Params: Options["Params"]; Type: JsonRow<Options["Row"]>[] }>
      : T extends PostgresQueryHandler<
             infer Options extends {
                Row: Record<string, unknown>;
                Params?: unknown;
             }
          >
        ? JsonAggregationPostgres<{ Row: Options["Row"]; Params: Options["Params"]; Type: JsonRow<Options["Row"]>[] }>
        : never;
