import { SqlQuery, SqlQueryToken, SqlRow, SqlParams } from "valnor";
import { PostgresQueryHandler } from "#/postgres-query-handler.js";

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   rawStrings: TemplateStringsArray,
   ...rawValues: Tokens
) {
   const query = new SqlQuery<{
      Row: SqlRow<typeof rawValues>;
      Params: SqlParams<typeof rawValues>;
   }>({ rawStrings: rawStrings, rawValues: rawValues });
   return new PostgresQueryHandler<{ Row: SqlRow<typeof rawValues>; Params: SqlParams<typeof rawValues> }>(query);
}
