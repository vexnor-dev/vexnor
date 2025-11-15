import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { SqlQuery, SqlQueryAny } from "./sql-query.js";
import { SqlQueryToken } from "../sql.js";
import { SqlType } from "./sql-type.js";
import { SqlQueryInfo } from "../charms/index.js";

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
      context.trackQuery(this.query);
      this.query.build(context);
   }
}

type ExtractType<T extends readonly unknown[]> = T extends readonly [infer First, ...infer Rest]
   ? First extends SqlType<infer U>
      ? U
      : ExtractType<Rest>
   : never;

export function val<T = unknown>(rawStrings: TemplateStringsArray, ...rawValues: SqlQueryToken[]) {
   const query = new SqlQuery({
      rawStrings,
      rawValues,
      info: new SqlQueryInfo({
         type: "val",
      }),
   });
   type InferredType = ExtractType<typeof rawValues> extends never ? T : ExtractType<typeof rawValues>;
   return {
      as: <Key extends string>(key: Key) => new SqlValue<{ Key: Key; Type: InferredType }>(query, key),
   };
}

export type InferRowFromValue<T> =
   T extends SqlValue<infer Value extends { Key: string; Type: unknown }> ? Record<Value["Key"], Value["Type"]> : never;
