import { sql } from "#src/core/sql.js";
import { SqlQuery, SqlQueryExtended } from "#src/core/query/sql-query.js";
import { raw } from "#src/core/query/sql-raw.js";
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
 * Creates a view query that wraps the source query, projecting only the
 * specified columns and adding window function expressions.
 *
 * The source query becomes a subquery in FROM. The view SELECT only emits
 * the columns listed in `options.columns` plus any window expressions.
 *
 * @example
 * ```typescript
 * const ranked = Account.postgres
 *   .select({ WHERE: sql`...` })
 *   .source.view({ columns: ["accountId", "email"], window: { rank: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } } } });
 * ```
 */
export function sqlView<TRow extends Record<string, unknown>>(
   source: SqlQuery<{ Row?: TRow; Params?: unknown }>,
   options: SqlViewOptions<TRow>,
): SqlQueryExtended<{ Row: Record<string, unknown>; Params: unknown }> {
   const columns = options.columns ?? [];
   const window = options.window ?? {};

   // Build SELECT column list
   const selectParts: string[] = [];
   for (const col of columns) {
      selectParts.push(`"sub"."${col}"`);
   }

   // Build window expressions
   const windowParts: string[] = [];
   for (const [alias, entry] of Object.entries(window)) {
      if (entry instanceof SqlQuery) {
         // Raw sql window expression — will be handled as subquery interpolation
         // For now, skip — we'll handle structured format first
         continue;
      }
      // Structured format
      const expr = buildWindowExpression(entry as WindowByEntry);
      windowParts.push(`${expr} as "${alias}"`);
   }

   // Combine
   const allParts = [...selectParts, ...windowParts];
   if (allParts.length === 0 || (columns.length === 0 && windowParts.length > 0)) {
      allParts.unshift(`"sub".*`);
   }

   const selectList = allParts.join(", ");
   const viewQuery = sql`SELECT ${raw(selectList)} FROM ${source} as "sub"`;
   return viewQuery as any;
}

/**
 * Builds a window function SQL expression from a structured entry.
 */
function buildWindowExpression(entry: WindowByEntry): string {
   const fn = entry.fn;
   let call: string;

   // Function call
   if (isRankingFn(fn)) {
      call = `${fn}()`;
   } else if (fn === "ntile") {
      const args = (entry as any).args ?? 4;
      call = `ntile(${args})`;
   } else if (isAggregateFn(fn)) {
      const col = (entry as any).col ?? "*";
      call = `${fn}("sub"."${col}")`;
   } else if (isOffsetFn(fn)) {
      const col = (entry as any).col;
      const offset = (entry as any).args ?? 1;
      call = `${fn}("sub"."${col}", ${offset})`;
   } else {
      call = `${fn}()`;
   }

   // OVER clause
   const over = entry.over;
   const overParts: string[] = [];

   if (over.partitionBy && over.partitionBy.length > 0) {
      overParts.push(`PARTITION BY ${over.partitionBy.map((c) => `"sub"."${c}"`).join(", ")}`);
   }
   if (over.orderBy && Object.keys(over.orderBy).length > 0) {
      const orderCols = Object.entries(over.orderBy as Record<string, string>)
         .map(([col, dir]) => `"sub"."${col}" ${dir.toUpperCase()}`)
         .join(", ");
      overParts.push(`ORDER BY ${orderCols}`);
   }
   if (over.frame && (over.start !== undefined || over.end !== undefined)) {
      const start = formatBound(over.start ?? "unbounded preceding", "start");
      const end = formatBound(over.end ?? "unbounded following", "end");
      overParts.push(`${over.frame.toUpperCase()} BETWEEN ${start} AND ${end}`);
   }

   return `${call} OVER (${overParts.join(" ")})`;
}

function formatBound(bound: string | number | undefined, position: "start" | "end"): string {
   if (typeof bound === "string") return bound;
   if (typeof bound === "number") {
      if (bound === 0) return "current row";
      return position === "start" ? `${bound} preceding` : `${bound} following`;
   }
   return position === "start" ? "unbounded preceding" : "unbounded following";
}

function isRankingFn(fn: string): boolean {
   return ["row_number", "rank", "dense_rank", "percent_rank", "cume_dist"].includes(fn);
}

function isAggregateFn(fn: string): boolean {
   return ["sum", "avg", "count", "min", "max", "first_value", "last_value"].includes(fn);
}

function isOffsetFn(fn: string): boolean {
   return ["lag", "lead"].includes(fn);
}
// ─── Usage: import "#src/core/query/sql-view.js" to add .view() to SqlQuery ──
// Or call sqlView(query, options) directly.

// Register with SqlQuery so .view() can call sqlView without circular import
SqlQuery._viewModule = { sqlView };
