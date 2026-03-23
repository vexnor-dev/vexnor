import { newSqlQuery, SqlQuery, SqlQueryExtended } from "#/core/query/sql-query.js";
import { ParamsOf, RowOf, Sql } from "#/core/sql-base.js";
import { Void } from "#/core/utils/utility-types.js";

type _SqlInlineValue_ = Sql | string | number | boolean | null | undefined | Date | bigint | Buffer;
export type SqlQueryToken = _SqlInlineValue_ | _SqlInlineValue_[];

/**
 * Template literal tag for building type-safe SQL queries.
 *
 * Accepts any mix of table references, column selectors, parameters, raw SQL,
 * and subqueries as interpolated values. The result type and required parameters
 * are inferred at compile time from what you embed in the template.
 *
 * Use the database-specific `sql` tag from a plugin package (`valnor-postgres`,
 * `valnor-mssql`, `valnor-sqlite3`) to get a query object that can be executed
 * directly. Use this core `sql` tag when composing reusable subqueries that will
 * be embedded into a plugin query.
 *
 * @example
 * // Subquery — composed into a plugin query later
 * const ActiveAccounts = sql`
 *   SELECT ${row(Account.$$)}
 *   FROM ${Account}
 *   WHERE ${Account.$active} = true
 * `;
 *
 * @example
 * // Parameterized query
 * const findById = sql`
 *   SELECT ${row(Account.$$)}
 *   FROM ${Account}
 *   WHERE ${Account.$accountId} = ${param<{ id: string }>("id")}
 * `;
 * // findById.params: { $id: SqlParam }
 * // findById result type: IAccountSelect
 */
export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   rawStrings: TemplateStringsArray,
   ...rawValues: Tokens
): SqlQueryExtended<{
   Params: SqlParams<typeof rawValues>;
   Row: SqlRow<typeof rawValues>;
}> {
   const query = new SqlQuery<{
      Params: SqlParams<typeof rawValues>;
      Row: SqlRow<typeof rawValues>;
   }>({ rawStrings, rawValues });
   return newSqlQuery(query);
}

export type SqlRow<T> = Void<BuildSqlRow<T>>;

type BuildSqlRow<T> = T extends [infer Start, ...infer Rest]
   ? Start extends [infer A, ...infer B]
      ? RowOf<A> & BuildSqlRow<B> & BuildSqlRow<Rest>
      : RowOf<Start> & BuildSqlRow<Rest>
   : void;

export type SqlParams<T> = Void<BuildSqlParams<T>>;

type BuildSqlParams<T> = T extends [infer Start, ...infer Rest]
   ? Start extends [infer A, ...infer B]
      ? ParamsOf<A> & BuildSqlParams<B> & BuildSqlParams<Rest>
      : ParamsOf<Start> & BuildSqlParams<Rest>
   : void;
