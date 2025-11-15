import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { SqlQueryAny } from "./sql-query.js";
import { sql, SqlQueryToken } from "../sql.js";

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

   is<Type>(): SqlValue<{ Key: T["Key"]; Type: Type }> {
      return this as SqlValue<{ Key: T["Key"]; Type: Type }>;
   }
}

export function val<T = unknown>(rawStrings: TemplateStringsArray, ...rawValues: SqlQueryToken[]) {
   const query = sql(rawStrings, ...rawValues);
   return <Key extends string>(key: Key) => new SqlValue<{ Key: Key; Type: T }>(query, key);
}

export type InferRowFromValue<T> =
   T extends SqlValue<infer Value extends { Key: string; Type: unknown }> ? Record<Value["Key"], Value["Type"]> : never;
