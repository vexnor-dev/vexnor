import {
   BuildSqlParams,
   CACHE,
   info,
   JsonRow,
   quote,
   quoteText,
   raw,
   row,
   sql,
   SqlBuildContext,
   SqlBuildError,
   SqlBuildOptions,
   SqlCharm,
   SqlQuery,
   SqlQueryAny,
   SqlSelectCharm,
} from "valnor";
import { ok } from "node:assert";

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
      const query = this.query;
      return new SqlSelectCharm<{ Key: Key; Type: T["Type"]; Params: T["Params"] }>({
         key,
         params: this.params as BuildSqlParams<T["Params"]>,
         write(context: SqlBuildContext) {
            const queryName = context.getQueryName(query);
            context.addStrings(`"${queryName}_result" as ${quoteText(this.key)}`);
         },
      });
   }
}

/**
 * Aggregates a subquery into a single JSON object using `to_jsonb`, or `null` if no row is found.
 *
 * Place it twice in the query: once in the SELECT list (to name the result column)
 * and once in the FROM/JOIN clause (to emit the lateral join). Use `.as(key)` in
 * the SELECT position to assign the result property name and type.
 *
 * @param query - The subquery whose first row will be aggregated into JSON.
 *
 * @example
 * const AccountParent = sql`
 *   SELECT ${row(Account.as("parent").$$)}
 *   FROM ${Account.as("parent")}
 *   WHERE ${Account.as("parent").$accountId} = ${Account.$parentId}
 * `;
 *
 * const result = await sql`
 *   SELECT ${row(Account.$$)}, ${jsonOne(AccountParent).as("parent")}
 *   FROM ${Account} ${jsonOne(AccountParent)}
 * `.getAll({ db: pool });
 * // result[0].parent: IAccountSelect | null
 */
export function jsonOne<T extends SqlQueryAny>(query: T): JsonAggregationResult<T> {
   return CACHE.get([query.id, `json=one`, "postgres"], () => {
      ok(query.$$, `'query.$$' is required. check if the query does return a row.`);
      const findOne = sql`select ${row(query.$$)} from ${query.inline()} limit 1`;
      return new JsonAggregationPostgres(findOne, {
         type: "one",
      }) as JsonAggregationResult<T>;
   });
}

/**
 * Aggregates a subquery into a JSON array using `jsonb_agg`, or `[]` if no rows are found.
 *
 * Place it twice in the query: once in the SELECT list (to name the result column)
 * and once in the FROM/JOIN clause (to emit the lateral join). Use `.as(key)` in
 * the SELECT position to assign the result property name and type.
 *
 * @param query - The subquery whose rows will be aggregated into a JSON array.
 *
 * @example
 * const UserOrders = sql`
 *   SELECT ${row(Order.$$)}
 *   FROM ${Order}
 *   WHERE ${Order.$accountId} = ${Account.$accountId}
 * `;
 *
 * const result = await sql`
 *   SELECT ${row(Account.$$)}, ${jsonMany(UserOrders).as("orders")}
 *   FROM ${Account} ${jsonMany(UserOrders)}
 * `.getAll({ db: pool });
 * // result[0].orders: IOrderSelect[]
 */
export function jsonMany<T extends SqlQueryAny>(query: T): JsonAggregationResult<T, []> {
   return CACHE.get(
      [query.id, `json=many`, "postgres"],
      () =>
         new JsonAggregationPostgres(query, {
            type: "many",
         }),
   ) as JsonAggregationResult<T>;
}

export type JsonAggregationResult<T, R extends object | [] = object> =
   T extends SqlQuery<infer O extends { Row?: unknown; Params?: unknown }>
      ? R extends []
         ? JsonAggregationPostgres<O & { Type: JsonRow<O["Row"]>[] }>
         : JsonAggregationPostgres<O & { Type: JsonRow<O["Row"]> | null }>
      : never;
