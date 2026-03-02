import { SqlQueryParams, SqlQueryRow, SqlQuery, SqlQueryToken } from "valnor";
import { MssqlQueryHandler } from "./mssql-query-handler.js";

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   rawStrings: TemplateStringsArray,
   ...rawValues: Tokens
): MssqlQueryHandler<{
   Row: SqlQueryRow<typeof rawValues>;
   Params: SqlQueryParams<typeof rawValues>;
}> {
   const query = new SqlQuery<{
      Row: SqlQueryRow<typeof rawValues>;
      Params: SqlQueryParams<typeof rawValues>;
   }>({ rawStrings, rawValues });
   return new MssqlQueryHandler<{
      Row: SqlQueryRow<typeof rawValues>;
      Params: SqlQueryParams<typeof rawValues>;
   }>(query);
}
