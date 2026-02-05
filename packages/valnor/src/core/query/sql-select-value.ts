import { QueryParams, SqlQueryToken } from "../sql.js";
import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { SqlBuildOptions } from "./sql-query-types.js";
import { SqlQuery, SqlQueryAny } from "./sql-query.js";
import { SqlQueryInfo } from "../charms/index.js";
import { quote } from "../utils/index.js";
import { SqlBuildError } from "../sql-build-error.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlSelectValueAny = SqlSelectValue<any>;

export type SqlSelectValueArgs<T extends { Key: string; Type: unknown; Params?: unknown }> = {
   query: SqlQuery<{ Params: T["Params"] }>;
   key: T["Key"];
   build?: (context: SqlBuildContext, options?: SqlBuildOptions) => void;
};

export class SqlSelectValue<T extends { Key: string; Type: unknown; Params?: unknown }> extends Sql {
   readonly query: SqlQuery<{ Params: T["Params"] }>;
   readonly key: T["Key"];
   readonly _build: null | ((context: SqlBuildContext, options?: SqlBuildOptions) => void);

   constructor({ query, key, build }: SqlSelectValueArgs<T>) {
      super({
         ID: `${query.rawStrings[0]} ... as ${String(key)}`,
      });
      this.query = query;
      this.key = key;
      this._build = build ?? null;
   }

   build(context: SqlBuildContext, options?: SqlBuildOptions): void {
      if (this._build) {
         this._build(context, options);
      } else {
         this.query.build(context, options);
         context.addStrings(` as ${quote(this.key)}`);
      }
   }
}

export function val<Type = unknown>(args: TemplateStringsArray | SqlQueryAny, ...rawValues: SqlQueryToken[]) {
   return {
      as: <Key extends string>(key: Key) => {
         switch (true) {
            case args instanceof SqlQuery:
               return new SqlSelectValue<{ Key: Key; Type: Type }>({ query: args, key });
            case Array.isArray(args): {
               const query = new SqlQuery<{ Params: QueryParams<typeof rawValues> }>({
                  rawStrings: args,
                  rawValues,
                  isFragment: true,
                  info: new SqlQueryInfo({ label: String(key) }),
               });
               return new SqlSelectValue<{ Key: Key; Type: Type; Params: QueryParams<typeof rawValues> }>({
                  query,
                  key,
               });
            }
            default:
               throw new SqlBuildError(`Args unknown or not supported: ${args}`);
         }
      },
   };
}
