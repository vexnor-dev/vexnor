import { SqlQuery, SqlQueryToken, SqlRow, SqlParams, SqlQueryExtended, newSqlQueryHandler } from "valnor";
import { PostgresQueryHandler } from "#/postgres-query-handler.js";

export type PostgresQueryExtended<T extends { Row?: unknown; Params?: unknown }> = PostgresQueryHandler<T> &
   SqlQueryExtended<T>;

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   rawStrings: TemplateStringsArray,
   ...rawValues: Tokens
): PostgresQueryExtended<{
   Params: SqlParams<typeof rawValues>;
   Row: SqlRow<typeof rawValues>;
}> {
   const query = new SqlQuery<{
      Row: SqlRow<typeof rawValues>;
      Params: SqlParams<typeof rawValues>;
   }>({ rawStrings: rawStrings, rawValues: rawValues });

   const handler = new PostgresQueryHandler<{
      Row: SqlRow<typeof rawValues>;
      Params: SqlParams<typeof rawValues>;
   }>(query);

   return newSqlQueryHandler(handler) as PostgresQueryExtended<{
      Params: SqlParams<typeof rawValues>;
      Row: SqlRow<typeof rawValues>;
   }>;
}
