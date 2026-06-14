// noinspection SqlNoDataSourceInspection,SqlResolve
import {
   raw,
   sql,
   SqlBuildContext,
   SqlBuildOptions,
   SqlCharm,
   SqlQuery,
   SqlQueryColumn,
   SqlSelectValue,
   JsonRow,
   SqlBuildError,
   quote,
   CACHE,
   row,
   SqlSelectCharm,
   SqlJsonSchema,
   SqlQueryBaseAny,
} from "vexnor";
import { ok } from "vexnor";

export type JsonResultType = "one" | "many";

/**
 * SQL class that aggregates a subquery into JSON for SQLite
 * Uses json_group_array for many, json_object for one.
 * @example
 * SELECT ${Account.$$}, ${jsonMany(AccountOrders).as("orders")}
 * FROM ${Account}
 * WHERE ${Account.$accountId} = ${param("accountId")}
 */
export class JsonAggregationSqlite3<
   T extends { Params?: unknown; Row?: unknown; Type?: Array<T["Row"]> | (T["Row"] | null) },
> extends SqlCharm<{
   Params: T["Params"];
}> {
   static readonly CONFIG: Record<
      JsonResultType,
      {
         coalesce: string;
      }
   > = {
      one: {
         coalesce: "null",
      },
      many: {
         coalesce: "'[]'",
      },
   };

   readonly type: JsonResultType;

   constructor(
      public readonly query: SqlQuery<T>,
      { type }: { type: JsonResultType },
   ) {
      super({
         type: "JsonAggregationSqlite3",
         id: query.id,
         params: query.params,
         hashId: `${type}:${query.hashId}`,
      });
      this.type = type;
   }

   write(context: SqlBuildContext, options: SqlBuildOptions) {
      if (!this.query.row) {
         throw new SqlBuildError(`'this.query.row' is required for json aggregation`);
      }

      const { coalesce } = JsonAggregationSqlite3.CONFIG[this.type];

      switch (context.keyword) {
         case "select": {
            context.addStrings("(");
            const innerQuery =
               this.type === "one"
                  ? sql`select json_object(${this.query.$$}) from ${this.query} limit 1`
                  : sql`select coalesce(json_group_array(json_object(${this.query.$$})), ${raw(coalesce)}) from ${this.query}`;

            innerQuery.build(context, options);
            context.addStrings(")");
            break;
         }
         default:
            throw new TypeError(`Cannot use json aggregation with SQL keyword '${context.keyword}'`);
      }
   }

   as<Key extends string>(key: Key): SqlSelectCharm<{ Key: Key; Type: T["Type"]; Params: T["Params"] }> {
      const fields = Object.values(this.query.row ?? {}).flatMap((value) => {
         if (value instanceof SqlSelectValue || value instanceof SqlQueryColumn) {
            return [raw(`'${value.key}'`), quote(value.key)];
         }
      });

      const { coalesce } = JsonAggregationSqlite3.CONFIG[this.type];
      const innerQuery =
         this.type === "one"
            ? sql`(select json_object(${fields}) from ${this.query} limit 1) as ${quote(key)}`
            : sql`(select coalesce(json_group_array(json_object(${fields})), ${raw(coalesce)}) from ${this.query}) as ${quote(key)}`;

      const innerSchema = this.query.jsonSchema;
      const jsonSchema: SqlJsonSchema = { [key]: this.type === "one" ? innerSchema : [innerSchema] };

      return new SqlSelectCharm<{ Key: Key; Type: T["Type"]; Params: T["Params"] }>({
         key,
         params: this.params,
         jsonSchema,
         write(context, options) {
            innerQuery.build(context, options);
         },
      });
   }
}

/**
 * Aggregates a subquery into a single JSON object using `json_object`, or `null` if no row is found.
 *
 * Unlike the PostgreSQL and MSSQL variants, this is used only in the SELECT list —
 * no second placement in the FROM clause is needed. Use `.as(key)` to assign
 * the result property name.
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
 *   FROM ${Account}
 * `.all({ db: database });
 * // result[0].parent: string (JSON — parse to IAccountSelect | null)
 */
export function jsonOne<T extends SqlQueryBaseAny>(query: T): JsonAggregationResult<T> {
   return CACHE.get([query.source.id, `json=one`, "sqlite3"], () => {
      ok(query.source.$$, `'query.$$' is required. check if the query does return a row.`);
      const findOne = sql`select ${row(query.source.$$)} from ${query.source.inline()} limit 1`;
      return new JsonAggregationSqlite3(findOne, {
         type: "one",
      });
   }) as JsonAggregationResult<T>;
}

/**
 * Aggregates a subquery into a JSON array using `json_group_array`, or `'[]'` if no rows are found.
 *
 * Unlike the PostgreSQL and MSSQL variants, this is used only in the SELECT list —
 * no second placement in the FROM clause is needed. Use `.as(key)` to assign
 * the result property name.
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
 *   FROM ${Account}
 * `.all({ db: database });
 * // result[0].orders: string (JSON — parse to IOrderSelect[])
 */
export function jsonMany<T extends SqlQueryBaseAny>(query: T): JsonAggregationResult<T, []> {
   return CACHE.get(
      [query.source.id, `json=many`, "sqlite3"],
      () =>
         new JsonAggregationSqlite3(query.source, {
            type: "many",
         }),
   ) as JsonAggregationResult<T>;
}

export type JsonAggregationResult<T, R extends object | [] = object> =
   T extends SqlQuery<infer O extends { Row?: unknown; Params?: unknown }>
      ? R extends []
         ? JsonAggregationSqlite3<O & { Type: JsonRow<O["Row"]>[] }>
         : JsonAggregationSqlite3<O & { Type: JsonRow<O["Row"]> | null }>
      : never;
