import { SqlQuery, SqlQueryToken, SqlRow, SqlParams, newSqlQueryHandler, SqlQueryExtended } from "valnor";
import { BetterSqlite3QueryHandler } from "#/better-sqlite3-query-handler.js";

export type BetterSqlite3QueryExtended<T extends { Row?: unknown; Params?: unknown }> = BetterSqlite3QueryHandler<T> &
   SqlQueryExtended<T>;

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   rawStrings: TemplateStringsArray,
   ...rawValues: Tokens
) {
   const query = new SqlQuery<{
      Row: SqlRow<typeof rawValues>;
      Params: SqlParams<typeof rawValues>;
   }>({ rawStrings: rawStrings, rawValues: rawValues });

   const handler = new BetterSqlite3QueryHandler<{
      Row: SqlRow<typeof rawValues>;
      Params: SqlParams<typeof rawValues>;
   }>(query);

   return newSqlQueryHandler(handler) as BetterSqlite3QueryExtended<{
      Row: SqlRow<typeof rawValues>;
      Params: SqlParams<typeof rawValues>;
   }>;
}
