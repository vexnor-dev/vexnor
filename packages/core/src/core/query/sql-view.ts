import { SqlQuery, SqlQueryExtended } from "#src/core/query/sql-query.js";
import type { WindowByEntry } from "#src/core/operators/sql-window-by.js";

/**
 * Options for `.view()` — defines the output shape of a query.
 */
export type SqlViewOptions<TRow = Record<string, unknown>> = {
   /** Which columns to include in the output. If omitted, all columns from the source query are included. */
   columns?: (keyof TRow & string)[] | string[];
   /** Window function expressions to add as computed columns. */
   window?: Record<string, WindowByEntry | SqlQuery<any>>;
};

/**
 * Creates a view query that projects only the specified columns from the source
 * and adds window function expressions — using build-time interception (no subquery wrapping).
 *
 * The source query's template is reused. During build:
 * - `row()` columns not in `options.columns` are skipped
 * - `col()` entries not in `options.columns` (and their preceding SQL expressions) are removed
 * - Window expressions are appended after the SELECT columns
 * - CTEs, WHERE, FROM, JOINs, ORDER BY pass through unchanged
 *
 * @example
 * ```typescript
 * const ranked = sqlView(myQuery, {
 *   columns: ["accountId", "email"],
 *   window: { rank: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } } }
 * });
 * ```
 */
export function sqlView<TRow extends Record<string, unknown>>(
   source: SqlQuery<{ Row?: TRow; Params?: unknown }>,
   options: SqlViewOptions<TRow>,
): SqlQueryExtended<{ Row: Record<string, unknown>; Params: unknown }> {
   // Use type assertion since sqlView's loose typing doesn't carry through the generic constraints
   return source.view(options as any) as any;
}
// sqlView() is available as a standalone function for direct use.
// .view() on SqlQuery is now implemented inline in sql-query.ts.
