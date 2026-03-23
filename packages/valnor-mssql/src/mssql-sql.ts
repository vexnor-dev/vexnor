import { SqlQuery, SqlQueryToken, SqlParams, SqlRow, SqlQueryExtended, newSqlQueryHandler } from "valnor";
import { MssqlQueryHandler } from "#/mssql-query-handler.js";

export type MssqlQueryExtended<T extends { Row?: unknown; Params?: unknown }> = MssqlQueryHandler<T> &
   SqlQueryExtended<T>;

/**
 * Template literal tag for building and executing type-safe MS SQL Server queries.
 *
 * Returns a query object with `.getAll()`, `.getOneRequired()`, and
 * `.getOneOptional()` methods that execute against an `mssql` `Request`
 * connection. Result type and required parameters are inferred at compile time.
 *
 * Use this instead of the core `sql` tag when you want a query that can be
 * executed directly against MS SQL Server.
 *
 * @example
 * import { sql } from 'valnor-mssql';
 *
 * const accounts = await sql`
 *   SELECT ${row(Account.$$)}
 *   FROM ${Account}
 *   WHERE ${Account.$active} = 1
 * `.getAll({ db: request });
 * // accounts: IAccountSelect[]
 *
 * @example
 * // With parameters
 * const account = await sql`
 *   SELECT ${row(Account.$$)}
 *   FROM ${Account}
 *   WHERE ${Account.$accountId} = ${param<{ id: string }>("id")}
 * `.getOneRequired({ db: request, params: { id: "123" } });
 * // account: IAccountSelect
 */
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
