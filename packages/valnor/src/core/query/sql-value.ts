import { SqlQueryToken, QueryParams } from "../sql.js";
import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { SqlBuildOptions } from "./sql-query-types.js";
import { SqlQuery } from "./sql-query.js";
import { SqlQueryInfo } from "../charms/index.js";
import { quote } from "../utils/index.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlValueAny = SqlValue<any>;

export class SqlValue<T extends { Key: string; Type: unknown; Params?: unknown }> extends Sql {
   readonly query: SqlQuery<T>;

   constructor(
      public readonly rawStrings: TemplateStringsArray,
      public readonly rawValues: SqlQueryToken[],
      public readonly key: T["Key"],
   ) {
      super({
         ID: `${rawStrings[0]} ... as ${String(key)}`,
      });
      this.query = new SqlQuery<T>({
         rawStrings,
         rawValues,
         isFragment: true,
         info: new SqlQueryInfo({ label: String(key) }),
      });
   }

   build(context: SqlBuildContext, options?: SqlBuildOptions): void {
      this.query.build(context, options);
      context.addStrings(` as ${quote(this.key)}`);
   }
}

export function val<Type = unknown>(rawStrings: TemplateStringsArray, ...rawValues: SqlQueryToken[]) {
   return {
      as: <Key extends string>(key: Key) =>
         new SqlValue<{ Key: Key; Type: Type; Params: QueryParams<typeof rawValues> }>(rawStrings, rawValues, key),
   };
}
