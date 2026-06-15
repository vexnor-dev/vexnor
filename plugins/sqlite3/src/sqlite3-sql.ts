import { SqlQuery, SqlQueryToken, SqlRow, SqlParams, newSqlQueryHandler, SqlQueryExtended, sqlBuildDefaults } from "vexnor";
import { BetterSqlite3QueryHandler } from "#/better-sqlite3-query-handler.js";

export type BetterSqlite3QueryExtended<T extends { Row?: unknown; Params?: unknown }> = BetterSqlite3QueryHandler<T> &
   SqlQueryExtended<T>;

/**
 * Template literal tag for building and executing type-safe SQLite queries.
 *
 * Returns a query object with `.all()`, `.one()`, and
 * `.any()` methods that execute against a `better-sqlite3`
 * `Database` connection. Result type and required parameters are inferred
 * at compile time.
 *
 * Use this instead of the core `sql` tag when you want a query that can be
 * executed directly against SQLite.
 *
 * @example
 * import { sql } from '@vexnor/sqlite3';
 *
 * const accounts = await sql`
 *   SELECT ${row(Account.$$)}
 *   FROM ${Account}
 *   WHERE ${Account.$active} = 1
 * `.all({ db: database });
 * // accounts: IAccountSelect[]
 *
 * @example
 * // With parameters
 * const account = await sql`
 *   SELECT ${row(Account.$$)}
 *   FROM ${Account}
 *   WHERE ${Account.$accountId} = ${param<{ id: string }>("id")}
 * `.one({ db: database, params: { id: "123" } });
 * // account: IAccountSelect
 */
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

/** Global build defaults. Set properties at app start to change defaults for all queries. */
Object.defineProperty(sql, "defaults", { value: sqlBuildDefaults, writable: false });

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace sql {
   export const defaults: typeof sqlBuildDefaults;
}
