import { PARAMS, Sql, SqlOptions } from "#src/core/sql-base.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlTableAny } from "#src/core/schema/sql-table.js";
import { SqlTableColumnAny } from "#src/core/schema/sql-table-column.js";
import { BuildSqlParams, PathToNested, SqlParam } from "#src/core/query/sql-param.js";
import { SqlBuildError } from "#src/core/sql-build-error.js";
import { resolvePath } from "#src/core/query/resolve-path.js";

// --- Function category constants ---

export const WindowByRankingFunctions = ["row_number", "rank", "dense_rank", "percent_rank", "cume_dist"] as const;
export type WindowByRankingFunction = (typeof WindowByRankingFunctions)[number];

export const WindowByBucketFunctions = ["ntile"] as const;
export type WindowByBucketFunction = (typeof WindowByBucketFunctions)[number];

export const WindowByAggregateFunctions = ["sum", "avg", "count", "min", "max", "first_value", "last_value"] as const;
export type WindowByAggregateFunction = (typeof WindowByAggregateFunctions)[number];

export const WindowByOffsetFunctions = ["lag", "lead"] as const;
export type WindowByOffsetFunction = (typeof WindowByOffsetFunctions)[number];

export type WindowByFunction = WindowByRankingFunction | WindowByBucketFunction | WindowByAggregateFunction | WindowByOffsetFunction;

const ALL_WINDOW_FUNCTIONS = new Set<string>([
   ...WindowByRankingFunctions,
   ...WindowByBucketFunctions,
   ...WindowByAggregateFunctions,
   ...WindowByOffsetFunctions,
]);

const RANKING_SET = new Set<string>(WindowByRankingFunctions);
const BUCKET_SET = new Set<string>(WindowByBucketFunctions);
const AGGREGATE_SET = new Set<string>(WindowByAggregateFunctions);

const VALID_DIRECTIONS = new Set(["ASC", "DESC", "asc", "desc"]);

// --- Types ---

export type WindowOver<T extends { Select: Record<string, unknown> } = { Select: Record<string, unknown> }> = {
   partitionBy?: (Extract<keyof T["Select"], string> & string)[];
   orderBy?: { [K in keyof T["Select"]]?: "ASC" | "DESC" | "asc" | "desc" };
   frame?: "rows" | "range";
   start?: "unbounded preceding" | "current row" | number;
   end?: "unbounded following" | "current row" | number;
};

export type WindowRanking<T extends { Select: Record<string, unknown> } = { Select: Record<string, unknown> }> = {
   fn: WindowByRankingFunction;
   over: WindowOver<T>;
};

export type WindowBucket<T extends { Select: Record<string, unknown> } = { Select: Record<string, unknown> }> = {
   fn: WindowByBucketFunction;
   args: number;
   over: WindowOver<T>;
};

export type WindowAggregate<T extends { Select: Record<string, unknown> } = { Select: Record<string, unknown> }> = {
   fn: WindowByAggregateFunction;
   col: Extract<keyof T["Select"], string> & string;
   over: WindowOver<T>;
};

export type WindowOffset<T extends { Select: Record<string, unknown> } = { Select: Record<string, unknown> }> = {
   fn: WindowByOffsetFunction;
   col: Extract<keyof T["Select"], string> & string;
   args?: number;
   over: WindowOver<T>;
};

export type WindowByEntry<T extends { Select: Record<string, unknown> } = { Select: Record<string, unknown> }> = WindowRanking<T> | WindowBucket<T> | WindowAggregate<T> | WindowOffset<T>;

export type WindowBySelect<T extends { Select: Record<string, unknown> } = { Select: Record<string, unknown> }> = Record<string, WindowByEntry<T>>;

export type SqlWindowByParams<T extends { Select: Record<string, unknown> } = { Select: Record<string, unknown> }, ParamName extends string = "windowBy"> = PathToNested<
   ParamName,
   WindowBySelect<T> | null | undefined
>;

/**
 * Infers the return type of a single window function entry based on its `fn` and `col`.
 *
 * - Ranking (row_number, rank, dense_rank, ntile) → `number` (never null)
 * - Distribution (percent_rank, cume_dist) → `number` (never null)
 * - count → `number` (never null, returns 0 not null)
 * - sum, avg → `number | null` (null when all values in frame are null)
 * - min, max → `T["Select"][col] | null`
 * - first_value, last_value → `T["Select"][col] | null`
 * - lag, lead → `T["Select"][col] | null` (null for first/last row)
 */
type InferWindowEntryType<T extends { Select: Record<string, unknown> }, Entry> =
   // Ranking + bucket → number (never null)
   Entry extends { fn: WindowByRankingFunction | WindowByBucketFunction } ? number :
   // count → number (never null)
   Entry extends { fn: "count" } ? number :
   // sum, avg → number | null
   Entry extends { fn: "sum" | "avg" } ? number | null :
   // min, max → column type | null
   Entry extends { fn: "min" | "max"; col: infer C } ?
      C extends keyof T["Select"] ? T["Select"][C] | null : number | null :
   // first_value, last_value → column type | null
   Entry extends { fn: "first_value" | "last_value"; col: infer C } ?
      C extends keyof T["Select"] ? T["Select"][C] | null : unknown :
   // lag, lead → column type | null
   Entry extends { fn: "lag" | "lead"; col: infer C } ?
      C extends keyof T["Select"] ? T["Select"][C] | null : unknown :
   unknown;

/**
 * Infers the additional row fields produced by a `windowBy` param.
 *
 * Maps each window alias to its precise return type based on the function category
 * and the referenced column's type from `T["Select"]`.
 *
 * @example
 * // Given Account with { email: string; createdAt: Date; ... }
 * InferWindowByRow<Account, { windowBy: {
 *   rank: { fn: "rank"; over: ... };           // → number
 *   prev: { fn: "lag"; col: "email"; over: ... };  // → string | null
 *   total: { fn: "count"; col: "*"; over: ... };   // → number
 * } }>
 * // = { rank: number; prev: string | null; total: number }
 */
export type InferWindowByRow<T extends { Select: Record<string, unknown> }, TParams> =
   TParams extends { windowBy: infer W }
      ? W extends Record<string, { fn: string; over: object }>
         ? { [K in keyof W]: InferWindowEntryType<T, W[K]> }
         : unknown
      : unknown;

/**
 * Portable WINDOW BY operator. At runtime, accepts an object mapping alias names
 * to window function definitions. Emits `, fn(...) OVER (...) AS "alias"` fragments
 * appended to the SELECT list.
 *
 * @example
 * params: { windowBy: { rowNum: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } } } }
 * // → , row_number() OVER (ORDER BY "created_at" DESC) AS "rowNum"
 */
export class SqlWindowBy<T extends { Select: Record<string, unknown> } = { Select: Record<string, unknown> }, ParamName extends string = "windowBy"> extends Sql {
   declare readonly [PARAMS]: SqlWindowByParams<T, ParamName>;

   readonly table: SqlTableAny;
   readonly paramName: ParamName;
   readonly fieldNames: string[];
   readonly params: BuildSqlParams<SqlWindowByParams<T, ParamName>>;

   get aiPrompt() {
      return `windowBy: { "alias": { fn, over: { partitionBy?, orderBy?, frame?, start?, end? }, col?, args? } }. ` +
         `Ranking fns (no col): row_number, rank, dense_rank, percent_rank, cume_dist. ` +
         `Bucket fn: ntile (args = bucket count). ` +
         `Aggregate fns (col required): sum, avg, count, min, max, first_value, last_value. ` +
         `Offset fns (col required): lag, lead (args = offset, default 1).`;
   }

   constructor(table: SqlTableAny, paramName: ParamName, fieldNames?: string[]) {
      super({
         type: "SqlWindowBy",
         id: `${table.tableInfo.name}.${paramName}`,
         hashId: `${table.hashId}|${paramName}`,
      } satisfies SqlOptions);

      this.table = table;
      this.paramName = paramName;
      this.fieldNames = fieldNames ?? table.colKeys;

      this.params = {
         [paramName]: new SqlParam({
            name: paramName,
            isContext: false,
         }),
      } as BuildSqlParams<SqlWindowByParams<T, ParamName>>;
   }

   write(context: SqlBuildContext): void {
      if (!context.params) {
         const columns: Record<string, string> = {};
         for (const [key, col] of Object.entries(this.table.cols)) {
            const column = col as SqlTableColumnAny;
            const before = context.tokens.length;
            column.build(context);
            const added = context.tokens.slice(before).map((t) => (t as { value: string }).value ?? "").join("");
            (context as unknown as { _tokens: unknown[] })._tokens.length = before;
            columns[key.slice(1)] = added;
         }
         context.addOperator({ type: "windowBy", param: this.paramName, columns });
         return;
      }

      const windowBy = resolvePath(context.params as Record<string, unknown>, this.paramName) as
         | WindowBySelect
         | null
         | undefined;
      if (!windowBy || typeof windowBy !== "object") return;

      const entries = Object.entries(windowBy);
      if (!entries.length) return;

      for (const [alias, entry] of entries) {
         const fn = entry.fn;
         if (!ALL_WINDOW_FUNCTIONS.has(fn)) {
            throw new SqlBuildError(`windowBy: invalid function '${fn}'. Valid: ${[...ALL_WINDOW_FUNCTIONS].join(", ")}`);
         }

         context.addStrings(", ");
         this.writeFunctionCall(context, entry);
         context.addStrings(` over (`);
         this.writeOverClause(context, entry.over);
         context.addStrings(`) as "${alias.replace(/"/g, '""')}"`);
      }
   }

   private writeFunctionCall(context: SqlBuildContext, entry: WindowByEntry): void {
      const fn = entry.fn;

      if (RANKING_SET.has(fn)) {
         if ("col" in entry && (entry as WindowAggregate).col !== undefined) {
            throw new SqlBuildError(`windowBy: ranking function '${fn}' does not accept 'col'`);
         }
         context.addStrings(`${fn}()`);
         return;
      }

      if (BUCKET_SET.has(fn)) {
         const bucketEntry = entry as WindowBucket;
         if (bucketEntry.args === undefined || bucketEntry.args === null) {
            throw new SqlBuildError(`windowBy: ntile requires 'args' (positive integer bucket count)`);
         }
         if (!Number.isInteger(bucketEntry.args) || bucketEntry.args <= 0) {
            throw new SqlBuildError(`windowBy: ntile 'args' must be a positive integer, got ${bucketEntry.args}`);
         }
         context.addStrings(`${fn}(${bucketEntry.args})`);
         return;
      }

      if (AGGREGATE_SET.has(fn)) {
         const aggEntry = entry as WindowAggregate;
         if (!aggEntry.col) {
            throw new SqlBuildError(`windowBy: aggregate function '${fn}' requires 'col'`);
         }
         context.addStrings(`${fn}(`);
         this.writeColumnRef(context, aggEntry.col);
         context.addStrings(`)`);
         return;
      }

      // Offset functions — must be the remaining case after ranking/bucket/aggregate
      const offsetEntry = entry as WindowOffset;
      if (!offsetEntry.col) {
         throw new SqlBuildError(`windowBy: offset function '${fn}' requires 'col'`);
      }
      const offset = offsetEntry.args ?? 1;
      context.addStrings(`${fn}(`);
      this.writeColumnRef(context, offsetEntry.col);
      context.addStrings(`, ${offset})`);
   }

   private writeColumnRef(context: SqlBuildContext, col: string): void {
      if (col === "*") {
         context.addStrings("*");
         return;
      }

      // Try resolving from columnMap (populated by joinBy/preColumnMap)
      if (context.columnCount > 0) {
         const resolved = context.getColumn(col);
         if (resolved) {
            resolved.render("tableAlias.columnName").build(context);
            return;
         }
      }

      // Try resolving from table columns directly
      const tableCol = this.table.cols[`$${col}` as `$${string}`] as SqlTableColumnAny | undefined;
      if (tableCol) {
         tableCol.render("tableAlias.columnName").build(context);
         return;
      }

      // Try dot-notation: strip prefix
      const dotIdx = col.indexOf(".");
      if (dotIdx !== -1) {
         const colKey = col.slice(dotIdx + 1);
         const stripped = this.table.cols[`$${colKey}` as `$${string}`] as SqlTableColumnAny | undefined;
         if (stripped) {
            stripped.render("tableAlias.columnName").build(context);
            return;
         }
      }

      // Validate the column name is in fieldNames
      if (!this.fieldNames.includes(col)) {
         throw new SqlBuildError(
            `windowBy: column '${col}' not found. Available: ${this.fieldNames.join(", ")}`,
         );
      }

      // Fallback: emit quoted identifier
      context.addStrings(`"${col.replace(/"/g, '""')}"`);
   }

   private writeOverClause(context: SqlBuildContext, over: WindowOver): void {
      let hasContent = false;

      // PARTITION BY
      if (over.partitionBy && over.partitionBy.length > 0) {
         context.addStrings("partition by ");
         for (let i = 0; i < over.partitionBy.length; i++) {
            if (i > 0) context.addStrings(", ");
            this.writeColumnRef(context, over.partitionBy[i]!);
         }
         hasContent = true;
      }

      // ORDER BY
      if (over.orderBy && Object.keys(over.orderBy).length > 0) {
         if (hasContent) context.addStrings(" ");
         context.addStrings("order by ");
         let emitted = 0;
         for (const [col, dir] of Object.entries(over.orderBy as Record<string, string>)) {
            if (!dir) continue;
            if (!VALID_DIRECTIONS.has(dir)) {
               throw new SqlBuildError(`windowBy: invalid orderBy direction '${dir}'. Must be ASC or DESC.`);
            }
            if (emitted > 0) context.addStrings(", ");
            this.writeColumnRef(context, col);
            context.addStrings(` ${dir.toUpperCase()}`);
            emitted++;
         }
         hasContent = true;
      }

      // FRAME
      if (over.start !== undefined || over.end !== undefined) {
         if (!over.frame) {
            throw new SqlBuildError(`windowBy: 'frame' (rows|range) is required when start/end are specified`);
         }
         if (over.frame === "range" && (typeof over.start === "number" || typeof over.end === "number")) {
            const dialect = context.dialect;
            if (dialect === "transactsql" || dialect === "tsql") {
               throw new SqlBuildError(
                  `windowBy: MSSQL does not support numeric bounds with RANGE frame. Use frame: "rows" instead.`,
               );
            }
         }
         if (hasContent) context.addStrings(" ");
         context.addStrings(`${over.frame} between `);
         context.addStrings(this.formatFrameBound(over.start ?? "unbounded preceding", "start"));
         context.addStrings(` and `);
         context.addStrings(this.formatFrameBound(over.end ?? "unbounded following", "end"));
      }
   }

   private formatFrameBound(bound: "unbounded preceding" | "unbounded following" | "current row" | number, position: "start" | "end"): string {
      if (typeof bound === "string") return bound;
      if (position === "start") {
         return bound === 0 ? "current row" : `${bound} preceding`;
      }
      return bound === 0 ? "current row" : `${bound} following`;
   }
}

/**
 * Window function operator — emits `, fn() OVER (...) AS "alias"` from a runtime param.
 */
export function windowBy<T extends { Select: Record<string, unknown> } = { Select: Record<string, unknown> }, ParamName extends string = "windowBy">(
   table: SqlTableAny,
   paramName?: ParamName,
   fieldNames?: string[],
): SqlWindowBy<T, ParamName> {
   return new SqlWindowBy<T, ParamName>(table, (paramName ?? "windowBy") as ParamName, fieldNames);
}
