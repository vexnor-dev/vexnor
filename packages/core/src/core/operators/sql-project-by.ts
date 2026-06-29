import { PARAMS, Sql, SqlOptions } from "#src/core/sql-base.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlTableAny } from "#src/core/schema/sql-table.js";
import { SqlTableColumnAny } from "#src/core/schema/sql-table-column.js";
import { BuildSqlParams, SqlParam } from "#src/core/query/sql-param.js";
import { SqlBuildError } from "#src/core/sql-build-error.js";
import { resolvePath } from "#src/core/query/resolve-path.js";
import { SqlLanguage } from "#src/format/sql-language.js";

export const SqlProjectByAggregation = ["sum", "count", "avg", "min", "max"] as const;
export type SqlProjectByAggregation = (typeof SqlProjectByAggregation)[number];

export const SqlProjectByTransform = ["dateTrunc", "coalesce", "round", "abs", "concat"] as const;
export type SqlProjectByTransform = (typeof SqlProjectByTransform)[number];

const VALID_DATE_TRUNC_GRANULARITIES: Set<string> = new Set(["year", "month", "day", "hour"]);

/**
 * Supported aggregate functions.
 */
export const sqlProjectByAggregations: Set<string> = new Set(SqlProjectByAggregation);

/**
 * Supported transform functions (included in GROUP BY).
 */
export const sqlProjectByTransforms: Set<string> = new Set(SqlProjectByTransform);

/**
 * A function/aggregate entry in the select object.
 */
export type SqlProjectByFnEntry = {
   fn: SqlProjectByAggregation | SqlProjectByTransform;
   col: string;
   args?: unknown | unknown[];
};

/**
 * A single select entry value in the object format.
 * - `true` → select column where alias matches key name
 * - `"colName"` → select column with rename (key is alias, value is source)
 * - `{ fn, col, args? }` → function/aggregate (key is alias)
 */
export type SqlProjectByEntryValue = true | string | SqlProjectByFnEntry;

/**
 * Object-format select param. Keys are aliases.
 */
export type SqlProjectBySelect<T extends Record<string, unknown> = Record<string, unknown>> = {
   [alias: string]: SqlProjectByEntryValue;
} & { [K in keyof T]?: SqlProjectByEntryValue };

/**
 * Standard projection params shape for CRUD select.
 */
export type SqlProjectByParams<T extends { Select: Record<string, unknown> }> = {
   select?: SqlProjectBySelect<T["Select"]>;
};

/**
 * Emits the SELECT column list from a runtime `select` param (object format).
 * If param is absent/empty, emits nothing (caller should fall back to row(table.$$)).
 */
export class SqlProjectBy<T extends Record<string, unknown>> extends Sql {
   declare readonly [PARAMS]: T;

   readonly table: SqlTableAny;
   readonly paramName: string;
   readonly params: BuildSqlParams<T>;

   get aiPrompt() {
      return `select: object where key=output alias. Values: true (same-name column), "sourceCol" (rename column), or {fn,col,args?} for functions.
  Aggregates (fn): ${SqlProjectByAggregation.join(", ")}. Example: {"fn":"count","col":"*"}, {"fn":"sum","col":"amount"}
  Transforms (fn): ${SqlProjectByTransform.join(", ")}.
    dateTrunc: args = "year"|"month"|"day"|"hour". Example: {"fn":"dateTrunc","col":"paymentDate","args":"month"}
    coalesce: args = default value or [fallback1, fallback2]. Example: {"fn":"coalesce","col":"notes","args":"N/A"}
    round: args = [precision]. Example: {"fn":"round","col":"amount","args":[2]}
    abs: no args needed. Example: {"fn":"abs","col":"amount"}
    concat: args = [parts to append]. Example: {"fn":"concat","col":"firstName","args":[" ","lastName"]}`;
   }

   constructor(table: SqlTableAny, paramName: string, fieldNames?: string[]) {
      super({
         type: "SqlProjection",
         id: `${table.tableInfo.name}.${paramName}`,
         hashId: `${table.hashId}|projection:${paramName}`,
      } satisfies SqlOptions);

      this.table = table;
      this.paramName = paramName;
      const columns = fieldNames ?? Object.keys(this.table.cols).map((k) => k.slice(1));
      this.params = {
         [paramName]: new SqlParam({
            name: paramName,
            validation: {
               obj: {
                  fieldNames: columns,
                  aggregates: ["sum", "count", "avg", "min", "max"],
               },
            },
         }),
      } as BuildSqlParams<T>;
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
         context.addOperator({ type: "projection", param: this.paramName, columns });
         return;
      }

      const selectObj = this.getSelectObject(context);
      if (!selectObj) {
         // No select param — emit all columns using their build() which handles aliasing
         const cols = Object.values(this.table.cols) as SqlTableColumnAny[];
         for (let i = 0; i < cols.length; i++) {
            if (i > 0) context.addStrings(", ");
            cols[i]!.build(context);
         }
         return;
      }

      const entries = Object.entries(selectObj);
      for (let i = 0; i < entries.length; i++) {
         if (i > 0) context.addStrings(", ");
         const [alias, value] = entries[i]!;

         if (value === true) {
            this.writeColumn(context, alias, alias);
         } else if (typeof value === "string") {
            this.writeColumn(context, value, alias);
         } else if (typeof value === "object" && value !== null && "fn" in value) {
            this.writeFn(context, alias, value as SqlProjectByFnEntry);
         } else {
            throw new SqlBuildError(`Invalid select entry for alias '${alias}': ${String(value)}`);
         }
      }
   }

   private writeColumn(context: SqlBuildContext, name: string, alias: string): void {
      const col = context.columnCount > 0
         ? (context.getColumn(name) ?? this.resolveColumn(name))
         : this.resolveColumn(name);
      if (alias === name) {
         // Same alias as source — use the column's natural rendering (includes AS if key != colName)
         col.build(context);
      } else {
         // Custom alias — render raw column ref, then add explicit alias
         col.render("tableAlias.columnName").build(context);
         context.addStrings(` as "${alias.replace(/"/g, '""')}"`);
      }
   }

   private writeFn(context: SqlBuildContext, alias: string, entry: SqlProjectByFnEntry): void {
      const { fn, col: colRef, args } = entry;
      const isAggregate = sqlProjectByAggregations.has(fn);
      const isTransform = sqlProjectByTransforms.has(fn);
      if (!isAggregate && !isTransform) throw new SqlBuildError(`Invalid function: ${fn}`);

      if (isAggregate) {
         this.writeAggregate(context, alias, fn, colRef);
      } else {
         this.writeTransform(context, alias, fn as SqlProjectByTransform, colRef, args);
      }
   }

   private writeAggregate(context: SqlBuildContext, alias: string, fn: string, colRef: string): void {
      context.addStrings(`${fn}(`);
      if (colRef === "*") {
         context.addStrings("*");
      } else if (typeof colRef === "string") {
         const col = context.columnCount > 0
            ? (context.getColumn(colRef) ?? context.getColumn(colRef.split(".").pop()!) ?? this.resolveColumn(colRef))
            : this.resolveColumn(colRef);
         col.render("tableAlias.columnName").build(context);
      } else {
         throw new SqlBuildError(`Invalid column reference in aggregate: ${String(colRef)}`);
      }
      context.addStrings(`) as "${alias.replace(/"/g, '""')}"`);
   }

   private writeTransform(context: SqlBuildContext, alias: string, fn: SqlProjectByTransform, colRef: string, args: unknown): void {
      const dialect = context.dialect;
      const colSql = this.renderColRef(context, colRef);
      const escapedAlias = alias.replace(/"/g, '""');

      switch (fn) {
         case "dateTrunc": {
            const expr = this.renderDateTrunc(context, dialect, colSql, args as string);
            context.addStrings(`${expr} as "${escapedAlias}"`);
            break;
         }
         case "coalesce": {
            const argsArr = Array.isArray(args) ? args : [args];
            context.addStrings(`coalesce(${colSql}, `);
            for (let i = 0; i < argsArr.length; i++) {
               if (i > 0) context.addStrings(", ");
               context.addValues(argsArr[i]);
            }
            context.addStrings(`) as "${escapedAlias}"`);
            break;
         }
         case "round": {
            const precision = Array.isArray(args) ? args[0] : args;
            if (precision != null) {
               if (typeof precision !== "number" || !Number.isFinite(precision)) {
                  throw new SqlBuildError(`Invalid round precision: "${precision}". Must be a finite number.`);
               }
               context.addStrings(`round(${colSql}, ${precision}) as "${escapedAlias}"`);
            } else {
               context.addStrings(`round(${colSql}) as "${escapedAlias}"`);
            }
            break;
         }
         case "abs":
            context.addStrings(`abs(${colSql}) as "${escapedAlias}"`);
            break;
         case "concat": {
            const parts = Array.isArray(args) ? args : [args];
            if (dialect === "transactsql" || dialect === "tsql") {
               context.addStrings(`CONCAT(${colSql}, `);
               for (let i = 0; i < parts.length; i++) {
                  if (i > 0) context.addStrings(", ");
                  context.addValues(parts[i]);
               }
               context.addStrings(`) as "${escapedAlias}"`);
            } else {
               context.addStrings(`${colSql} || `);
               for (let i = 0; i < parts.length; i++) {
                  if (i > 0) context.addStrings(" || ");
                  context.addValues(parts[i]);
               }
               context.addStrings(` as "${escapedAlias}"`);
            }
            break;
         }
         default:
            throw new SqlBuildError(`Unsupported transform: ${fn}`);
      }
   }

   private renderDateTrunc(_context: SqlBuildContext, dialect: SqlLanguage, colSql: string, granularity: string): string {
      if (!VALID_DATE_TRUNC_GRANULARITIES.has(granularity)) {
         throw new SqlBuildError(`Invalid dateTrunc granularity: "${granularity}". Allowed: ${[...VALID_DATE_TRUNC_GRANULARITIES].join(", ")}`);
      }
      if (dialect === "sqlite") {
         const fmtMap: Record<string, string> = {
            year: "%Y-01-01",
            month: "%Y-%m-01",
            day: "%Y-%m-%d",
            hour: "%Y-%m-%d %H:00:00",
         };
         return `strftime('${fmtMap[granularity]!}', ${colSql})`;
      }
      if (dialect === "transactsql" || dialect === "tsql") {
         return `DATETRUNC(${granularity}, ${colSql})`;
      }
      // PostgreSQL and others
      return `date_trunc('${granularity}', ${colSql})`;
   }

   private renderColRef(context: SqlBuildContext, colRef: string): string {
      if (colRef === "*") return "*";
      const col = context.columnCount > 0
         ? (context.getColumn(colRef) ?? context.getColumn(colRef.split(".").pop()!) ?? this.resolveColumn(colRef))
         : this.resolveColumn(colRef);
      // Build the column reference into a temporary context to get its SQL string
      const before = context.tokens.length;
      col.render("tableAlias.columnName").build(context);
      const tokens = context.tokens.slice(before);
      const sql = tokens.map((t) => (t as { value: string }).value ?? "").join("");
      (context as unknown as { _tokens: unknown[] })._tokens.length = before;
      return sql;
   }

   private resolveColumn(name: string): SqlTableColumnAny {
      const col = this.table.cols[`$${name}` as `$${string}`] as SqlTableColumnAny | undefined;
      if (col) return col;
      const dot = name.indexOf(".");
      if (dot !== -1) {
         const colKey = name.slice(dot + 1);
         const stripped = this.table.cols[`$${colKey}` as `$${string}`] as SqlTableColumnAny | undefined;
         if (stripped) return stripped;
      }
      throw new SqlBuildError(`Column not found: ${name}`);
   }

   private getSelectObject(context: SqlBuildContext): Record<string, SqlProjectByEntryValue> | null {
      const val = resolvePath(context.params as Record<string, unknown>, this.paramName) as Record<string, SqlProjectByEntryValue> | null | undefined;
      if (!val || typeof val !== "object" || Object.keys(val).length === 0) return null;
      return val;
   }
}

/**
 * Emits GROUP BY for non-aggregate columns when a `select` param has aggregates.
 * Transforms are included in GROUP BY; aggregates are excluded.
 * Produces no output if no aggregates or no select param.
 */
export class SqlProjectionGroupBy<T extends Record<string, unknown>> extends Sql {
   declare readonly [PARAMS]: T;

   readonly table: SqlTableAny;
   readonly paramName: string;

   constructor(table: SqlTableAny, paramName: string) {
      super({
         type: "SqlProjectionGroupBy",
         id: `${table.tableInfo.name}.${paramName}.groupBy`,
         hashId: `${table.hashId}|projectionGroupBy:${paramName}`,
      } satisfies SqlOptions);

      this.table = table;
      this.paramName = paramName;
   }

   write(context: SqlBuildContext): void {
      if (!context.params) return;

      const selectObj = resolvePath(context.params as Record<string, unknown>, this.paramName) as Record<string, SqlProjectByEntryValue> | null | undefined;
      if (!selectObj || typeof selectObj !== "object" || Object.keys(selectObj).length === 0) return;

      const groupByExprs: string[] = [];
      let hasAggregate = false;

      for (const [alias, value] of Object.entries(selectObj)) {
         if (typeof value === "object" && value !== null && "fn" in value) {
            const entry = value as SqlProjectByFnEntry;
            if (sqlProjectByAggregations.has(entry.fn)) {
               hasAggregate = true;
            } else if (sqlProjectByTransforms.has(entry.fn)) {
               // Transforms go into GROUP BY — render same expression
               const expr = this.renderTransformForGroupBy(context, entry);
               if (expr) groupByExprs.push(expr);
            }
         } else {
            // Plain column reference — resolve and render
            const colName = value === true ? alias : (value as string);
            const col = context.columnCount > 0
               ? (context.getColumn(colName) ?? this.resolveColumn(colName))
               : this.resolveColumn(colName);
            if (col) {
               const before = context.tokens.length;
               col.build(context);
               const tokens = context.tokens.slice(before);
               const sql = tokens.map((t) => (t as { value: string }).value ?? "").join("");
               (context as unknown as { _tokens: unknown[] })._tokens.length = before;
               groupByExprs.push(sql);
            }
         }
      }

      if (!hasAggregate || !groupByExprs.length) return;

      context.addStrings("group by " + groupByExprs.join(", "));
   }

   private renderTransformForGroupBy(context: SqlBuildContext, entry: SqlProjectByFnEntry): string | null {
      const { fn, col: colRef, args } = entry;
      const colSql = this.renderColRef(context, colRef);
      const dialect = context.dialect;

      switch (fn) {
         case "dateTrunc": {
            const granularity = args as string;
            if (!VALID_DATE_TRUNC_GRANULARITIES.has(granularity)) return null;
            if (dialect === "sqlite") {
               const fmtMap: Record<string, string> = { year: "%Y-01-01", month: "%Y-%m-01", day: "%Y-%m-%d", hour: "%Y-%m-%d %H:00:00" };
               return `strftime('${fmtMap[granularity]!}', ${colSql})`;
            }
            if (dialect === "transactsql" || dialect === "tsql") return `DATETRUNC(${granularity}, ${colSql})`;
            return `date_trunc('${granularity}', ${colSql})`;
         }
         case "coalesce": {
            const argsArr = Array.isArray(args) ? args : [args];
            return `coalesce(${colSql}, ${argsArr.map(() => "?").join(", ")})`;
         }
         case "round": {
            const precision = Array.isArray(args) ? args[0] : args;
            if (precision != null && (typeof precision !== "number" || !Number.isFinite(precision))) return null;
            return precision != null ? `round(${colSql}, ${precision})` : `round(${colSql})`;
         }
         case "abs":
            return `abs(${colSql})`;
         case "concat": {
            const parts = Array.isArray(args) ? args : [args];
            if (dialect === "transactsql" || dialect === "tsql") {
               return `CONCAT(${colSql}, ${parts.map(() => "?").join(", ")})`;
            }
            return `${colSql} || ${parts.map(() => "?").join(" || ")}`;
         }
         default:
            return null;
      }
   }

   private renderColRef(context: SqlBuildContext, colRef: string): string {
      const col = context.columnCount > 0
         ? (context.getColumn(colRef) ?? context.getColumn(colRef.split(".").pop()!) ?? this.resolveColumn(colRef))
         : this.resolveColumn(colRef);
      const before = context.tokens.length;
      col.render("tableAlias.columnName").build(context);
      const tokens = context.tokens.slice(before);
      const sql = tokens.map((t) => (t as { value: string }).value ?? "").join("");
      (context as unknown as { _tokens: unknown[] })._tokens.length = before;
      return sql;
   }

   private resolveColumn(name: string): SqlTableColumnAny {
      const col = this.table.cols[`$${name}` as `$${string}`] as SqlTableColumnAny | undefined;
      if (col) return col;
      const dot = name.indexOf(".");
      if (dot !== -1) {
         const colKey = name.slice(dot + 1);
         const stripped = this.table.cols[`$${colKey}` as `$${string}`] as SqlTableColumnAny | undefined;
         if (stripped) return stripped;
      }
      throw new SqlBuildError(`Column not found: ${name}`);
   }
}


