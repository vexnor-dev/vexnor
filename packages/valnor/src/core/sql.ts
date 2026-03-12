import { newSqlQuery, SqlQuery, SqlQueryExtended } from "#/core/query/sql-query.js";
import { ParamsOf, RowOf, Sql } from "#/core/sql-base.js";
import { Void } from "#/core/utils/utility-types.js";

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

export type SqlRow<T> = Void<BuildSqlRow<T>>;

type BuildSqlRow<T> = T extends [infer Start, ...infer Rest]
   ? Start extends [infer A, ...infer B]
      ? RowOf<A> & BuildSqlRow<B> & BuildSqlRow<Rest>
      : RowOf<Start> & BuildSqlRow<Rest>
   : void;

export type SqlParams<T> = Void<BuildSqlParams<T>>;

type BuildSqlParams<T> = T extends [infer Start, ...infer Rest]
   ? Start extends [infer A, ...infer B]
      ? ParamsOf<A> & BuildSqlParams<B> & BuildSqlParams<Rest>
      : ParamsOf<Start> & BuildSqlParams<Rest>
   : void;
