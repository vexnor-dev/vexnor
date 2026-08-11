import {
   CACHE,
   BuildSqlParams,
   JsonRow,
   ok,
   quote,
   raw,
   row,
   sql,
   SqlBuildContext,
   SqlBuildError,
   SqlBuildOptions,
   SqlCharm,
   SqlJsonSchema,
   SqlQuery,
   SqlQueryBase,
   SqlQueryBaseAny,
   SqlSelectCharm,
} from "@vexnor/core";

export type DuckDBJsonResultType = "one" | "many";

export class JsonAggregationDuckDB<
   T extends { Row?: unknown; Params?: unknown; Type?: Array<T["Row"]> | (T["Row"] | null) },
> extends SqlCharm<Pick<T, "Params" | "Type">> {
   readonly type: DuckDBJsonResultType;

   constructor(public readonly query: SqlQuery<Pick<T, "Row" | "Params">>, { type }: { type: DuckDBJsonResultType }) {
      super({
         type: "JsonAggregationDuckDB",
         id: query.id,
         params: query.params,
         hashId: `${type}:${query.hashId}`,
      });
      this.type = type;
   }

   write(context: SqlBuildContext, options?: SqlBuildOptions): void {
      if (!this.query.row) throw new SqlBuildError("query row is required for DuckDB JSON aggregation");
      if (context.keyword !== "select") {
         throw new SqlBuildError(`Cannot use ${this.constructor.name} with SQL keyword: ${context.keyword}`);
      }
      this.buildInner(context, options);
   }

   as<Key extends string>(key: Key): SqlSelectCharm<{ Key: Key; Type: T["Type"]; Params: T["Params"] }> {
      const query = this.query;
      const type = this.type;
      const innerSchema = query.jsonSchema;
      const jsonSchema: SqlJsonSchema = { [key]: type === "one" ? innerSchema : [innerSchema] };
      return new SqlSelectCharm<{ Key: Key; Type: T["Type"]; Params: T["Params"] }>({
         key,
         params: this.params as BuildSqlParams<T["Params"]>,
         jsonSchema,
         write(context, options) {
            new JsonAggregationDuckDB(query, { type }).buildInner(context, options ?? undefined);
            sql`as ${quote(key)}`.build(context, options, { queryType: "inline" });
         },
      });
   }

   private buildInner(context: SqlBuildContext, options?: SqlBuildOptions): void {
      const queryName = context.getQueryName(this.query);
      const expression = this.type === "one"
         ? sql`(select to_json(${quote(queryName)}) from ${this.query} limit 1)`
         : sql`(select coalesce(json_group_array(${quote(queryName)}), ${raw("'[]'")}) from ${this.query})`;
      expression.build(context, options, { queryType: "inline" });
   }
}

export function jsonOne<T extends SqlQueryBaseAny>(query: T): JsonAggregationResult<T> {
   return CACHE.get([query.source.id, "json=one", "duckdb"], () => {
      ok(query.source.$$, "'query.$$' is required. check if the query does return a row.");
      const findOne = sql`select ${row(query.source.$$)} from ${query.source.inline()} limit 1`;
      return new JsonAggregationDuckDB(findOne, { type: "one" });
   }) as JsonAggregationResult<T>;
}

export function jsonMany<T extends SqlQueryBaseAny>(query: T): JsonAggregationResult<T, []> {
   return CACHE.get(
      [query.source.id, "json=many", "duckdb"],
      () => new JsonAggregationDuckDB(query.source, { type: "many" }),
   ) as JsonAggregationResult<T, []>;
}

export type JsonAggregationResult<T, R extends object | [] = object> =
   T extends SqlQueryBase<infer O extends { Row?: unknown; Params?: unknown }>
      ? R extends []
         ? JsonAggregationDuckDB<O & { Type: JsonRow<O["Row"]>[] }>
         : JsonAggregationDuckDB<O & { Type: JsonRow<O["Row"]> | null }>
      : never;
