import { SqlQuery, SqlQueryToken, SqlRow, SqlParams } from "valnor";
import { BetterSqlite3QueryHandler } from "./better-sqlite3-query-handler.js";

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   rawStrings: TemplateStringsArray,
   ...rawValues: Tokens
) {
   const query = new SqlQuery<{
      Row: SqlRow<typeof rawValues>;
      Params: SqlParams<typeof rawValues>;
   }>({ rawStrings: rawStrings, rawValues: rawValues });
   return new BetterSqlite3QueryHandler<{
      Row: SqlRow<typeof rawValues>;
      Params: SqlParams<typeof rawValues>;
   }>(query);
}
