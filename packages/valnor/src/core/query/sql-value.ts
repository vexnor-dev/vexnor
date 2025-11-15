import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { SqlQueryAny } from "./sql-query.js";
import { sql, SqlQueryToken } from "../sql.js";
import { SqlType } from "./sql-type.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlValueAny = SqlValue<any>;

export class SqlValue<T extends { Key: string; Type: unknown }> extends Sql {
   constructor(
      public readonly query: SqlQueryAny,
      public readonly key: T["Key"],
   ) {
      super({
         ID: `${query.toString()} AS ${key}`,
      });
   }

   build(context: SqlBuildContext) {
      this.query.build(context);
   }
}

type ExtractType<T extends readonly unknown[]> = 
   T extends readonly [infer First, ...infer Rest]
      ? First extends SqlType<infer U> ? U : ExtractType<Rest>
      : never;

export function val<T = unknown>(rawStrings: TemplateStringsArray, ...rawValues: SqlQueryToken[]) {
   const query = sql(rawStrings, ...rawValues);
   type InferredType = ExtractType<typeof rawValues> extends never ? T : ExtractType<typeof rawValues>;
   return {
      as: <Key extends string>(key: Key) => new SqlValue<{ Key: Key; Type: InferredType }>(query, key),
   };
}

export type InferRowFromValue<T> =
   T extends SqlValue<infer Value extends { Key: string; Type: unknown }> ? Record<Value["Key"], Value["Type"]> : never;
