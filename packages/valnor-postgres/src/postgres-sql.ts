import { SqlQueryParams, SqlQueryRow, SqlQuery, SqlQueryToken } from "valnor";
import { PostgresQueryHandler } from "./postgres-query-handler.js";

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   rawStrings: TemplateStringsArray,
   ...rawValues: Tokens
) {
   const query = new SqlQuery<{
      Row: SqlQueryRow<typeof rawValues>;
      Params: SqlQueryParams<typeof rawValues>;
   }>({ rawStrings: rawStrings, rawValues: rawValues });
   return new PostgresQueryHandler<{ Row: SqlQueryRow<typeof rawValues>; Params: SqlQueryParams<typeof rawValues> }>(
      query,
   );
}
