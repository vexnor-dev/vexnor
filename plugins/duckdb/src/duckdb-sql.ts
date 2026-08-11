import { newSqlQueryHandler, SqlParams, SqlQuery, SqlQueryExtended, SqlQueryToken, SqlRow, sqlBuildDefaults } from "@vexnor/core";
import { DuckDBQueryHandler } from "#src/duckdb-query-handler.js";

export type DuckDBQueryExtended<T extends { Row?: unknown; Params?: unknown }> = DuckDBQueryHandler<T> & SqlQueryExtended<T>;

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   rawStrings: TemplateStringsArray,
   ...rawValues: Tokens
): DuckDBQueryExtended<{
   Params: SqlParams<typeof rawValues>;
   Row: SqlRow<typeof rawValues>;
}> {
   const query = new SqlQuery<{
      Row: SqlRow<typeof rawValues>;
      Params: SqlParams<typeof rawValues>;
   }>({ rawStrings, rawValues });
   return newSqlQueryHandler(new DuckDBQueryHandler(query)) as DuckDBQueryExtended<{
      Params: SqlParams<typeof rawValues>;
      Row: SqlRow<typeof rawValues>;
   }>;
}

Object.defineProperty(sql, "defaults", { value: sqlBuildDefaults, writable: false });

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace sql {
   export const defaults: typeof sqlBuildDefaults;
}
