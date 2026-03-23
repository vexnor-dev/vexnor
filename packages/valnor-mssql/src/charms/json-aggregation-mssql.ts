import {
   BuildSqlParams,
   CACHE,
   PARAMS,
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
import { ok } from "valnor/plugin";

export type JsonResultType = "one" | "many";

/**
 * SQL class that aggregates of a subquery into a JSON array
 * @example
 * SELECT ${Account.$$all}, ${jsonAgg(UserOrders)} "orders"
 * FROM ${Account} ${jsonAgg(UserOrders)}
 * WHERE ${Account.$accountId} = ${param("accountId")}
 */
export class JsonAggregationMssql<T extends { Row?: unknown; Params?: unknown }> extends SqlCharm<Pick<T, "Params">> {
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
   declare readonly [PARAMS]: T["Params"];
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
            context.addStrings(`"${queryName}_result"."${queryName}"`);
            break;
         case "from": {
            const { FOR_JSON } = JsonAggregationMssql.CONFIG[this.type] ?? {};
            ok(FOR_JSON !== undefined, `FOR_JSON is not defined for type: ${this.type}`);
            const query = sql`
               outer apply (
               select coalesce((${this.query.render("default")} ${raw(FOR_JSON)}), ${raw(this.type === "one" ? "null" : "'[]'")})
                  as ${quote(queryName)}) as ${quote(`${queryName}_result`)}`;

            query.build(context, options, { queryType: "inline" });
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
         write(context: SqlBuildContext) {
            const queryName = context.getQueryName(query);
            context.addStrings(`"${queryName}_result"."${queryName}" as ${quoteText(this.key)}`);
         },
      });
   }
}

/**
 * Aggregates a subquery into a single JSON object using `FOR JSON PATH, WITHOUT_ARRAY_WRAPPER`,
 * or `null` if no row is found.
 *
 * Place it twice in the query: once in the SELECT list (to name the result column)
 * and once in the FROM clause (to emit the OUTER APPLY). Use `.as(key)` in
 * the SELECT position to assign the result property name.
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
 * `.getAll({ db: request });
 * // result[0].parent: string (JSON — parse to IAccountSelect | null)
 */
export function jsonOne<T extends SqlQueryAny>(query: T): JsonAggregationResult<T> {
   return CACHE.get([query.id, `json=one`, "mssql"], () => {
      ok(query.$$, `'query.$$' is required. check if the query does return a row.`);
      const findOne = sql`select top 1 ${row(query.$$)} from ${query.inline()}`;
      return new JsonAggregationMssql(findOne, {
         type: "one",
      }) as JsonAggregationResult<T>;
   });
}

/**
 * Aggregates a subquery into a JSON array using `FOR JSON PATH`, or `'[]'` if no rows are found.
 *
 * Place it twice in the query: once in the SELECT list (to name the result column)
 * and once in the FROM clause (to emit the OUTER APPLY). Use `.as(key)` in
 * the SELECT position to assign the result property name.
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
 * `.getAll({ db: request });
 * // result[0].orders: string (JSON — parse to IOrderSelect[])
 */
export function jsonMany<T extends SqlQueryAny>(query: T): JsonAggregationResult<T, []> {
   return CACHE.get(
      [query.id, `json=many`, "mssql"],
      () =>
         new JsonAggregationMssql(query, {
            type: "many",
         }),
   ) as JsonAggregationResult<T>;
}

export type JsonAggregationResult<T, R extends object | [] = object> =
   T extends SqlQuery<infer O extends { Row?: unknown; Params?: unknown }>
      ? R extends []
         ? JsonAggregationMssql<O & { Type: string }>
         : JsonAggregationMssql<O & { Type: string }>
      : never;
