import { SqlQuery, SqlQueryAny } from "#/core/query/sql-query.js";
import { PARAMS, ROW, Sql, TYPE } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#/core/builder/sql-build-options.js";
import { SqlParams, SqlQueryToken } from "#/core/sql.js";
import { SqlBuildError } from "#/core/sql-build-error.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlSelectValueAny = SqlSelectValue<any>;

export type SqlSelectValueArgs<T extends { Key: string; Type: unknown; Params?: unknown }> = Pick<
   SqlSelectValue<T>,
   "key"
> & {
   innerQuery: SqlQuery<{ Params: T["Params"] }>;
};

export class SqlSelectValue<T extends { Key: string; Type: unknown; Params?: unknown }> extends Sql {
   declare readonly [ROW]: Record<T["Key"], T["Type"]>;
   declare readonly [TYPE]: Record<T["Key"], T["Type"]>;
   declare readonly [PARAMS]: T["Params"];

   readonly innerQuery: SqlQuery<{ Params: T["Params"] }>;
   readonly key: T["Key"];

   constructor({ innerQuery, key }: SqlSelectValueArgs<T>) {
      super({
         id: `${innerQuery.rawStrings[0]} ... as ${String(key)}`,
      });
      this.innerQuery = innerQuery;
      this.key = key;
      this.queries = [innerQuery];
   }

   get params(): T["Params"] {
      return this.innerQuery.params;
   }

   readonly queries: SqlQueryAny[];

   write(context: SqlBuildContext, options?: SqlBuildOptions): void {
      this.innerQuery.build(context, options, { queryType: "inline", queryFormat: "select" });
      context.addStrings(` as "${this.key}"`);
   }
}

export function val<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   rawStrings: TemplateStringsArray | SqlQueryAny,
   ...rawValues: Tokens
) {
   return {
      as: <T extends Record<string, unknown>>(
         key: Extract<keyof T, string>,
      ): SqlSelectValue<{
         Key: Extract<keyof T, string>;
         Type: T[typeof key];
         Params: SqlParams<typeof rawValues>;
      }> => {
         switch (true) {
            case rawStrings instanceof SqlQuery:
               return new SqlSelectValue({ innerQuery: rawStrings, key });
            case Array.isArray(rawStrings): {
               return new SqlSelectValue({
                  innerQuery: new SqlQuery<{ Params: SqlParams<typeof rawValues> }>({
                     rawStrings: rawStrings,
                     rawValues,
                  }),
                  key,
               });
            }
            default:
               throw new SqlBuildError(`Args unknown or not supported: ${rawStrings}`);
         }
      },
   };
}
