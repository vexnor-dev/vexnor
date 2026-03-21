import { SqlQuery, SqlQueryToken, SqlParams, SqlRow, SqlQueryExtended, newSqlQueryHandler } from "valnor";
import { MssqlQueryHandler } from "#/mssql-query-handler.js";

export type MssqlQueryExtended<T extends { Row?: unknown; Params?: unknown }> = MssqlQueryHandler<T> &
   SqlQueryExtended<T>;

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   rawStrings: TemplateStringsArray,
   ...rawValues: Tokens
): MssqlQueryExtended<{
   Row: SqlRow<typeof rawValues>;
   Params: SqlParams<typeof rawValues>;
}> {
   const query = new SqlQuery<{
      Row: SqlRow<typeof rawValues>;
      Params: SqlParams<typeof rawValues>;
   }>({ rawStrings, rawValues });

   const handler = new MssqlQueryHandler<{
      Row: SqlRow<typeof rawValues>;
      Params: SqlParams<typeof rawValues>;
   }>(query);

   return newSqlQueryHandler(handler) as MssqlQueryExtended<{
      Params: SqlParams<typeof rawValues>;
      Row: SqlRow<typeof rawValues>;
   }>;
}
