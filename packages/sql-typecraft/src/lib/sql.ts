import { RowOut, SqlParams, SqlValue } from "./sql-types.js";
import { SqlQuery } from "./sql-query.js";
import { Sql } from "./sql-base.js";

/**
 * Creates a typed SQL query using plain SQL syntax and generated db mapping code.
 * @typeParam TResult - row result type of the query
 * @typeParam TParams - type of the query parameters (object)
 * @typeParam TValue - item type of the query values
 * @param strings template strings
 * @param values template values
 * @example
 * ```ts
 * const query = sql<IUserSelect, { userId: string }>`
 * SELECT ${User.$$all} FROM ${User} WHERE ${User.userId} = ${param("userId")}`;

 * const result = await query.run(db, { userId: "a1" });
 * ```
 */
export function sql<
   TResult extends RowOut,
   TParams extends Record<string, SqlValue> | undefined = undefined,
   TValue =
      | SqlValue
      | Sql
      | Sql[]
      | SqlQuery<any, Partial<TParams>>
      | SqlQuery<any, Partial<TParams>>[]
      | SqlParams<TParams>,
>(strings: TemplateStringsArray, ...values: TValue[]): SqlQuery<TResult, TParams> {
   return new SqlQuery(strings, values);
}
