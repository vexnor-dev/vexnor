import {
   SqlBuildOptions,
   SqlBuildContext,
   SqlQuery,
   quoteText,
   SqlBuildError,
   PARAMS,
   SqlCharm,
   SqlSelectCharm,
   sql,
   raw,
   BuildSqlParams,
   SqlQueryAny,
   quote,
} from "valnor";
import { ok } from "node:assert";

export type JsonResultType = "one" | "many";

/**
 * SQL class that aggregates of a subquery into a JSON array
 * @example
 * SELECT ${Account.$$all}, ${jsonAgg(UserOrders)} "orders"
 * FROM ${Account} ${jsonAgg(UserOrders)}
 * WHERE ${Account.$accountId} = ${param("accountId")}
 */
export class JsonAggregationMssql<T extends { Row?: unknown; Params?: unknown }> extends SqlCharm<Pick<T, "Params">> {
   declare readonly [PARAMS]: T["Params"];
   static readonly CONFIG: Record<
      JsonResultType,
      {
         FOR_JSON: string;
      }
   > = {
      one: {
         FOR_JSON: "for json path, WITHOUT_ARRAY_WRAPPER, include_null_values",
      },
      many: {
         FOR_JSON: "for json path, include_null_values",
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
            context.addStrings(`"${queryName}_result"."${queryName}"`);
            break;
         case "from": {
            const { FOR_JSON } = JsonAggregationMssql.CONFIG[this.type] ?? {};
            ok(FOR_JSON !== undefined, `FOR_JSON is not defined for type: ${this.type}`);
            const query = sql`
               outer apply (
               select coalesce((${this.query.render("sql")} ${raw(FOR_JSON)}), '[]')
                  as ${quote(queryName)}) as ${quote(`${queryName}_result`)}`;

            context.scope({ query, inline: true }, () => {
               query.build(context, options);
            });
            break;
         }
         default:
            throw new TypeError(`Cannot use JsonAggregationMssql with SQL keyword: ${context.keyword}`);
      }
   }

   /**
    * Returns a SqlSelectValue with the specified key.
    * @param key
    */
   as<Key extends string>(key: Key): SqlSelectCharm<{ Key: Key; Type: string; Params: T["Params"] }> {
      const query = this.query;
      return new SqlSelectCharm<{ Key: Key; Type: string; Params: T["Params"] }>({
         key,
         params: this.params as BuildSqlParams<T["Params"]>,
         build(context: SqlBuildContext) {
            const queryName = context.getQueryName(query);
            context.addStrings(`"${queryName}_result"."${queryName}" as ${quoteText(this.key)}`);
         },
      });
   }
}

/**
 * Creates a new JsonAggregationPostgres object core block.
 * @param query sql core to aggregate
 * @returns JsonAggregationPostgres object core block
 * @example
 * SELECT ${Account.$$}, ${jsonOne(AccountParent).as("parent")}
 * FROM ${Account} ${jsonOne(AccountParent)}
 * WHERE ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
 * */
export function jsonOne<T extends SqlQueryAny>(query: T): JsonAggregationResult<T> {
   return new JsonAggregationMssql(query, {
      type: "one",
   }) as JsonAggregationResult<T>;
}

/**
 * Creates a new JsonAggregationPostgres object core block.
 * @param query sql core to aggregate
 * @returns JsonAggregationPostgres object core block
 * @example
 * SELECT ${Account.$$}, ${jsonMany(UserOrders).as("orders")}
 * FROM ${Account} ${jsonMany(UserOrders)}
 * WHERE ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
 * */
export function jsonMany<T extends SqlQueryAny>(query: T): JsonAggregationResult<T, []> {
   return new JsonAggregationMssql(query, {
      type: "many",
   }) as JsonAggregationResult<T>;
}

export type JsonAggregationResult<T, R extends object | [] = object> =
   T extends SqlQuery<infer O extends { Row?: unknown; Params?: unknown }>
      ? R extends []
         ? JsonAggregationMssql<O & { Type: string }>
         : JsonAggregationMssql<O & { Type: string }>
      : never;
