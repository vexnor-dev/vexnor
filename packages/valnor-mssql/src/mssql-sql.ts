import { SqlQuery, SqlQueryToken, SqlParams, SqlRow } from "valnor";
import { MssqlQueryHandler } from "./mssql-query-handler.js";

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   rawStrings: TemplateStringsArray,
   ...rawValues: Tokens
): MssqlQueryHandler<{
   Row: SqlRow<typeof rawValues>;
   Params: SqlParams<typeof rawValues>;
}> {
   const query = new SqlQuery<{
      Row: SqlRow<typeof rawValues>;
      Params: SqlParams<typeof rawValues>;
   }>({ rawStrings, rawValues });
   return new MssqlQueryHandler(query);
}
