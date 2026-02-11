import { QueryParams, QueryRow, SqlQuery, SqlQueryToken } from "valnor";
import { PostgresQueryHandler } from "./postgres-query-handler.js";

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   rawStrings: TemplateStringsArray,
   ...rawValues: Tokens
) {
   const query = new SqlQuery<{
      Row: QueryRow<typeof rawValues>;
      Params: QueryParams<typeof rawValues>;
   }>({ rawStrings: rawStrings, rawValues: rawValues });
   return new PostgresQueryHandler<{ Row: QueryRow<typeof rawValues>; Params: QueryParams<typeof rawValues> }>(query);
}
