import type { SqlTable, SqlTableAny } from "#src/core/schema/sql-table.js";

export type JoinOperator = "=" | "<" | "<=" | ">" | ">=" | "<>";
export type JoinType = "inner" | "left" | "right" | "full" | "cross";

/**
 * Produces `"alias.colName"` union for all columns of a table under a given alias.
 */
export type AliasDotCol<Alias extends string, T extends SqlTableAny> =
   T extends SqlTable<infer TArgs>
      ? `${Alias}.${Extract<keyof TArgs["Select"], string>}`
      : never;

/**
 * Union of all `"alias.col"` keys across an alias map.
 */
export type JoinedTablesDotCols<M extends Record<string, SqlTableAny>> = {
   [K in Extract<keyof M, string>]: AliasDotCol<K, M[K]>;
}[Extract<keyof M, string>];

/**
 * Qualified column reference for the root table: `"_.colName"`.
 */
type RootDotCol<RootCols extends string> = `_.${RootCols}`;

/**
 * All valid column references in a join context:
 * - `"_.col"` for root table columns
 * - `"alias.col"` for joined table columns
 */
type AllDotCols<RootCols extends string, M extends Record<string, SqlTableAny>> =
   RootDotCol<RootCols> | JoinedTablesDotCols<M>;

/**
 * A single ON condition: always a 3-tuple `[left, operator, right]`.
 *
 * - Left: any qualified column (`"_.col"` or `"alias.col"`)
 * - Right: a column from the target alias being joined (`"alias.col"`)
 *
 * @example
 * ["_.accountId", "=", "account.accountId"]
 * ["order.accountId", "=", "account.accountId"]
 */
export type JoinCondition<
   LeftCols extends string,
   RightAlias extends string,
   RightCols extends string,
> = [LeftCols, JoinOperator, `${RightAlias}.${RightCols}`];

/**
 * Runtime joinBy param — object keyed by alias, values are condition arrays.
 *
 * @example
 * joinBy: {
 *   account: [["_.accountId", "=", "account.accountId"]],
 *   order: { on: [["_.orderId", "=", "order.orderId"]] },
 *   account: { on: [["order.accountId", "=", "account.accountId"]], type: "left" },
 * }
 */
export type JoinByMap<
   RootCols extends string = string,
   M extends Record<string, SqlTableAny> = Record<string, SqlTableAny>,
> = {
   [K in Extract<keyof M, string>]?: M[K] extends SqlTable<infer TArgs>
      ? { on: Array<JoinCondition<AllDotCols<RootCols, M>, K, Extract<keyof TArgs["Select"], string>>>; type?: JoinType } | null
      : never;
};
