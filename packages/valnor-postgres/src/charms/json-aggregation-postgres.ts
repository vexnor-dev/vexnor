import {
   BuildSqlParams,
   info,
   JsonRow,
   quote,
   quoteText,
   raw,
   sql,
   SqlBuildContext,
   SqlBuildError,
   SqlBuildOptions,
   SqlCharm,
   SqlQuery,
   SqlQueryAny,
   SqlSelectCharm,
} from "valnor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonAggregationPostgresAny = JsonAggregationPostgres<any>;

export type JsonResultType = "one" | "many";

export class JsonAggregationPostgres<
   T extends { Row?: unknown; Params?: unknown; Type?: Array<T["Row"]> | (T["Row"] | null) },
> extends SqlCharm<Pick<T, "Params" | "Type">> {
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

   write(context: SqlBuildContext, options: SqlBuildOptions) {
      if (!this.query.row) {
         throw new SqlBuildError(`query row is required for json aggregation`);
      }

      const queryName = context.getQueryName(this.query);
      switch (context.keyword) {
         case "select":
            context.addStrings(`"${queryName}_result"`);
            break;
         case "on true":
         case "from": {
            const { coalesce, func } = JsonAggregationPostgres.resultTypes[this.type];
            const query = sql`
                ${info({ inline: true })}
               left join lateral (
               select coalesce(${raw(func)}(${this.query.$$}), ${raw(coalesce)}) as ${quote(`${queryName}_result`)}
               from ${this.query}) as ${quote(queryName)}
               on true
            `;
            query.build(context, options, { queryType: "inline" });
            break;
         }
         default:
            throw new SqlBuildError(`Cannot use ${this.constructor.name} with SQL keyword: ${context.keyword}`);
      }
   }

   /**
    * Returns a SqlSelectValue with the specified key.
    * @param key
    */
   as<Key extends string>(key: Key): SqlSelectCharm<{ Key: Key; Type: T["Type"]; Params: T["Params"] }> {
      const _query = this.query;
      return new SqlSelectCharm<{ Key: Key; Type: T["Type"]; Params: T["Params"] }>({
         key,
         params: this.params as BuildSqlParams<T["Params"]>,
         write(context: SqlBuildContext) {
            const queryName = context.getQueryName(_query);
            context.addStrings(`"${queryName}_result" as ${quoteText(this.key)}`);
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
   return new JsonAggregationPostgres(query, {
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
   return new JsonAggregationPostgres(query, {
      type: "many",
   }) as JsonAggregationResult<T>;
}

export type JsonAggregationResult<T, R extends object | [] = object> =
   T extends SqlQuery<infer O extends { Row?: unknown; Params?: unknown }>
      ? R extends []
         ? JsonAggregationPostgres<O & { Type: JsonRow<O["Row"]>[] }>
         : JsonAggregationPostgres<O & { Type: JsonRow<O["Row"]> | null }>
      : never;
