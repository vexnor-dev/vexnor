import { RowOut, SqlParams, SqlValue } from "./sql-types.js";
import { SqlQuery } from "./sql-query.js";
import { Sql } from "./sql-base.js";
import { SqlTable } from "./sql-table.js";
import { SqlColumn } from "./sql-column.js";

/**
 * Creates a typed SQL core using plain SQL syntax and generated db mapping code.
 * @typeParam TResult - row result type of the core
 * @typeParam TParams - type of the core parameters (object)
 * @typeParam TValue - item type of the core values
 * @param strings template strings
 * @param values template values
 * @example
 * ```ts
 * const core = sql<IUserSelect, { userId: string }>`
 * SELECT ${User.$$all} FROM ${User} WHERE ${User.userId} = ${param("userId")}`;

 * const result = await core.run(db, { userId: "a1" });
 * ```
 */
export function sql<
   TRow extends RowOut = RowOut,
   TParams extends Record<string, SqlValue> | undefined = undefined,
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   TSql extends Sql = Sql | SqlTable<any> | SqlColumn,
   TValue =
      | SqlValue
      | TSql
      | TSql[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | SqlQuery<{ Row: any; Params: Partial<TParams>; QueryResult: object }>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | SqlQuery<{ Row: any; Params: Partial<TParams>; QueryResult: object }>[]
      | SqlParams<TParams>,
>(
   strings: TemplateStringsArray,
   ...values: TValue[]
): SqlQuery<{
   Row: TRow;
   QueryResult: { rows: TRow[] };
   Params: TParams;
}> {
   return new SqlQuery(strings, values);
}
