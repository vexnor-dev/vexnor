import { AsyncQueryHandler, SqlQuery, SqlQueryExtended, newSqlQuery } from "./query/index.js";
import { Sql, ParamsOf, RowOf } from "./sql-base.js";

type _SqlInlineValue_ = Sql | string | number | boolean | null | undefined | Date | bigint | Buffer;
export type SqlQueryToken = _SqlInlineValue_ | _SqlInlineValue_[];

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   rawStrings: TemplateStringsArray,
   ...rawValues: Tokens
): SqlQueryExtended<{
   Params: QueryParams<typeof rawValues>;
   Row: QueryRow<typeof rawValues>;
}> {
   const query = new SqlQuery<{
      Params: QueryParams<typeof rawValues>;
      Row: QueryRow<typeof rawValues>;
   }>({ rawStrings, rawValues });
   return newSqlQuery<{
      Params: QueryParams<typeof rawValues>;
      Row: QueryRow<typeof rawValues>;
   }>(query);
}

export type InferRowFromSqlTokens<T> = T extends [infer Start, ...infer Rest]
   ? Start extends [infer A, ...infer B]
      ? Merge<Merge<RowOf<A>, InferRowFromSqlTokens<B>>, InferRowFromSqlTokens<Rest>>
      : Merge<RowOf<Start>, InferRowFromSqlTokens<Rest>>
   : unknown;

type Merge<A, B> = [A] extends [never]
   ? [B] extends [never]
      ? void
      : B
   : [B] extends [never]
     ? A
     : { [K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never };

export type InferParamsFromSqlTokens<T> = T extends [infer Start, ...infer Rest]
   ? Start extends [infer A, ...infer B]
      ? Merge<Merge<ParamsOf<A>, InferParamsFromSqlTokens<B>>, InferParamsFromSqlTokens<Rest>>
      : Merge<ParamsOf<Start>, InferParamsFromSqlTokens<Rest>>
   : unknown;

export type QueryParams<T> = [keyof InferParamsFromSqlTokens<T>] extends [never] ? void : InferParamsFromSqlTokens<T>;
export type QueryRow<T> = InferRowFromSqlTokens<T>;

export type ExtractResultRowFromQuery<T> =
   T extends SqlQueryExtended<infer U extends { Row?: unknown }> ? U["Row"] : never;

export type ExtractParamsFromQuery<T> =
   T extends SqlQueryExtended<infer U extends { Params?: any }>
      ? U["Params"]
      : T extends AsyncQueryHandler<infer U extends { Params?: any; Row?: any; QueryResult: any; QueryClient: any }>
        ? U["Params"]
        : never;
