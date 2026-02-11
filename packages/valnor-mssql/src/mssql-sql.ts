import { QueryParams, QueryRow, SqlQuery, SqlQueryToken } from "valnor";
import { MssqlQueryHandler } from "./mssql-query-handler.js";

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   rawStrings: TemplateStringsArray,
   ...rawValues: Tokens
): MssqlQueryHandler<{
   Row: QueryRow<typeof rawValues>;
   Params: QueryParams<typeof rawValues>;
}> {
   const query = new SqlQuery<{
      Row: QueryRow<typeof rawValues>;
      Params: QueryParams<typeof rawValues>;
   }>({ rawStrings, rawValues });
   return new MssqlQueryHandler<{
      Row: QueryRow<typeof rawValues>;
      Params: QueryParams<typeof rawValues>;
   }>(query);
}
