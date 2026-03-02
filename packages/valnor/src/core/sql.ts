import { newSqlQuery, SqlQuery, SqlQueryExtended, SqlQueryHandler } from "./query/index.js";
import { ParamsOf, RowOf, Sql } from "./sql-base.js";
import { Simplify } from "./utils/index.js";

type _SqlInlineValue_ = Sql | string | number | boolean | null | undefined | Date | bigint | Buffer;
export type SqlQueryToken = _SqlInlineValue_ | _SqlInlineValue_[];

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   rawStrings: TemplateStringsArray,
   ...rawValues: Tokens
): SqlQueryExtended<{
   Params: SqlParams<typeof rawValues>;
   Row: SqlRow<typeof rawValues>;
}> {
   const query = new SqlQuery<{
      Params: SqlParams<typeof rawValues>;
      Row: SqlRow<typeof rawValues>;
   }>({ rawStrings, rawValues });
   return newSqlQuery(query);
}

export type SqlRow<T> = Simplify<_SqlQueryRow_<T>>;

type _SqlQueryRow_<T> = T extends [infer Start, ...infer Rest]
   ? Start extends [infer A, ...infer B]
      ? RowOf<A> & _SqlQueryRow_<B> & _SqlQueryRow_<Rest>
      : RowOf<Start> & _SqlQueryRow_<Rest>
   : void;

export type SqlParams<T> = Simplify<_SqlQueryParams_<T>>;

type _SqlQueryParams_<T> = T extends [infer Start, ...infer Rest]
   ? Start extends [infer A, ...infer B]
      ? ParamsOf<A> & _SqlQueryParams_<B> & _SqlQueryParams_<Rest>
      : ParamsOf<Start> & _SqlQueryParams_<Rest>
   : void;

export type ExtractResultRowFromQuery<T> =
   T extends SqlQueryExtended<infer U extends { Row?: unknown }> ? U["Row"] : never;

export type ExtractParamsFromQuery<T> =
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   T extends SqlQueryExtended<infer U extends { Params?: any }>
      ? U["Params"]
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        T extends SqlQueryHandler<infer U extends { Params?: any; Row?: any; QueryResult: any; Connection: any }>
        ? U["Params"]
        : never;
