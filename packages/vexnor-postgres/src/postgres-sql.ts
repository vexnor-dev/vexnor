import { SqlQuery, SqlQueryToken, SqlRow, SqlParams, SqlQueryExtended, newSqlQueryHandler, sqlBuildDefaults } from "vexnor";
import { PostgresQueryHandler } from "#/postgres-query-handler.js";

export type PostgresQueryExtended<T extends { Row?: unknown; Params?: unknown }> = PostgresQueryHandler<T> &
   SqlQueryExtended<T>;

/**
 * Template literal tag for building and executing type-safe PostgreSQL queries.
 *
 * Returns a query object with `.all()`, `.one()`, and
 * `.any()` methods that execute against a `pg` connection.
 * Result type and required parameters are inferred at compile time.
 *
 * Use this instead of the core `sql` tag when you want a query that can be
 * executed directly against PostgreSQL.
 *
 * @example
 * import { sql } from 'vexnor-postgres';
 *
 * const accounts = await sql`
 *   SELECT ${row(Account.$$)}
 *   FROM ${Account}
 *   WHERE ${Account.$active} = true
 * `.all({ db: pool });
 * // accounts: IAccountSelect[]
 *
 * @example
 * // With parameters
 * const account = await sql`
 *   SELECT ${row(Account.$$)}
 *   FROM ${Account}
 *   WHERE ${Account.$accountId} = ${param<{ id: string }>("id")}
 * `.one({ db: pool, params: { id: "123" } });
 * // account: IAccountSelect
 */
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

/** Global build defaults. Set properties at app start to change defaults for all queries. */
Object.defineProperty(sql, "defaults", { value: sqlBuildDefaults, writable: false });

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace sql {
   export const defaults: typeof sqlBuildDefaults;
}
