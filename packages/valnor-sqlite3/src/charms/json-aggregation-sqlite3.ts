import {
   raw,
   sql,
   SqlBuildContext,
   SqlBuildOptions,
   SqlCharm,
   SqlQuery,
   SqlSelectCharm,
   SqlQueryColumn,
   SqlSelectValue,
   BuildSqlParams,
   SqlQueryAny,
   JsonRow,
   SqlBuildError,
   quote,
} from "valnor";

export type JsonResultType = "one" | "many";

/**
 * SQL class that aggregates a subquery into JSON for SQLite
 * Uses json_group_array for many, json_object for one.
 * @example
 * SELECT ${Account.$$}, ${jsonMany(AccountOrders).as("orders")}
 * FROM ${Account}
 * WHERE ${Account.$accountId} = ${param("accountId")}
 */
export class JsonAggregationSqlite3<T extends { Params?: unknown; Row?: unknown }> extends SqlCharm<{
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
         id: query.id,
         params: query.params,
      });
      this.type = type;
   }

   build(context: SqlBuildContext, options: SqlBuildOptions) {
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

   as<Key extends string>(key: Key): SqlSelectCharm<{ Key: Key; Type: string; Params: T["Params"] }> {
      const fields = Object.values(this.query.row ?? {}).flatMap((value) => {
         if (value instanceof SqlSelectValue || value instanceof SqlQueryColumn) {
            return [raw(`'${value.key}'`), quote(value.key)];
         }
      });

      const { coalesce } = JsonAggregationSqlite3.CONFIG[this.type];
      const innerQuery =
         this.type === "one"
            ? sql`(select json_object(${fields}) from ${this.query.render("inline")} limit 1) as ${quote(key)}`
            : sql`(select coalesce(json_group_array(json_object(${fields})), ${raw(coalesce)}) from ${this.query.render("inline")}) as ${quote(key)}`;

      return new SqlSelectCharm<{ Key: Key; Type: string; Params: T["Params"] }>({
         key,
         params: this.params as BuildSqlParams<T["Params"]>,
         build(context, options) {
            innerQuery.build(context, options);
         },
      });
   }
}

/**
 * Creates a new JsonAggregationSqlite3 object for single row aggregation
 * @param query sql query to aggregate
 * @returns JsonAggregationSqlite3 object
 * @example
 * SELECT ${Account.$$}, ${jsonOne(AccountParent).as("parent")}
 * FROM ${Account}
 * WHERE ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
 */
export function jsonOne<T extends SqlQueryAny>(query: T): JsonAggregationResult<T> {
   return new JsonAggregationSqlite3(query, {
      type: "one",
   }) as JsonAggregationResult<T>;
}

/**
 * Creates a new JsonAggregationSqlite3 object for array aggregation
 * @param query sql query to aggregate
 * @returns JsonAggregationSqlite3 object
 * @example
 * SELECT ${Account.$$}, ${jsonMany(AccountOrders).as("orders")}
 * FROM ${Account}
 * WHERE ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
 */
export function jsonMany<T extends SqlQueryAny>(query: T): JsonAggregationResult<T, []> {
   return new JsonAggregationSqlite3(query, {
      type: "many",
   }) as JsonAggregationResult<T>;
}

export type JsonAggregationResult<T, R extends object | [] = object> =
   T extends SqlQuery<infer O extends { Row?: unknown; Params?: unknown }>
      ? R extends []
         ? JsonAggregationSqlite3<O & { Type: JsonRow<O["Row"]>[] }>
         : JsonAggregationSqlite3<O & { Type: JsonRow<O["Row"]> | null }>
      : never;
