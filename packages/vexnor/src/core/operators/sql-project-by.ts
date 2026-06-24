import { PARAMS, Sql, SqlOptions } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlTableAny } from "#/core/schema/sql-table.js";
import { SqlTableColumnAny } from "#/core/schema/sql-table-column.js";
import { BuildSqlParams, SqlParam } from "#/core/query/sql-param.js";
import { SqlBuildError } from "#/core/sql-build-error.js";
import { resolvePath } from "#/core/query/resolve-path.js";

export const SqlProjectByAggregation = ["sum" , "count" , "avg" , "min" , "max"] as const;
export type SqlProjectByAggregation = (typeof SqlProjectByAggregation)[number];

/**
 * Supported aggregate functions.
 */
export const sqlProjectByAggregations: Set<string> = new Set(SqlProjectByAggregation);

/**
 * A single select entry — column reference or aggregate function call.
 */
export type SqlProjectByEntry<T extends Record<string, unknown> = Record<string, unknown>> =
   | (keyof T & string)
   | [SqlProjectByAggregation, "*", string]
   | [SqlProjectByAggregation, keyof T & string, string];

/**
 * Standard projection params shape for CRUD select.
 */
export type SqlProjectByParams<T extends { Select: Record<string, unknown> }> = {
   select?: SqlProjectByEntry<T["Select"]>[];
};

/**
 * Emits the SELECT column list from a runtime `select` param.
 * If param is absent/empty, emits nothing (caller should fall back to row(table.$$)).
 */
export class SqlProjectBy<T extends Record<string, unknown>> extends Sql {
   declare readonly [PARAMS]: T;

   readonly table: SqlTableAny;
   readonly paramName: string;
   readonly params: BuildSqlParams<T>;

   constructor(table: SqlTableAny, paramName: string) {
      super({
         type: "SqlProjection",
         id: `${table.tableInfo.name}.${paramName}`,
         hashId: `${table.hashId}|projection:${paramName}`,
      } satisfies SqlOptions);

      this.table = table;
      this.paramName = paramName;
      const columns = Object.keys(this.table.cols).map((k) => k.slice(1));
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

      const entries = this.getEntries(context);
      if (!entries) {
         // No select param — emit all columns using their build() which handles aliasing
         const cols = Object.values(this.table.cols) as SqlTableColumnAny[];
         for (let i = 0; i < cols.length; i++) {
            if (i > 0) context.addStrings(", ");
            cols[i]!.build(context);
         }
         return;
      }

      for (let i = 0; i < entries.length; i++) {
         if (i > 0) context.addStrings(", ");
         const entry = entries[i]!;

         if (Array.isArray(entry)) {
            this.writeAggregate(context, entry as [string, unknown, string]);
         } else if (typeof entry === "string") {
            const col = this.resolveColumn(entry);
            col.build(context);
         } else {
            throw new SqlBuildError(`Invalid select entry: ${String(entry)}`);
         }
      }
   }

   private writeAggregate(context: SqlBuildContext, entry: [string, unknown, string]): void {
      const [fn, colRef, alias] = entry;
      if (!sqlProjectByAggregations.has(fn)) throw new SqlBuildError(`Invalid aggregate function: ${fn}`);
      if (!alias) throw new SqlBuildError(`Aggregate function '${fn}' requires an alias`);

      context.addStrings(`${fn}(`);

      if (colRef === "*") {
         context.addStrings("*");
      } else if (typeof colRef === "string") {
         const col = this.resolveColumn(colRef);
         col.render("tableAlias.columnName").build(context);
      } else {
         throw new SqlBuildError(`Invalid column reference in aggregate: ${String(colRef)}`);
      }

      context.addStrings(`) as "${alias}"`);
   }

   private resolveColumn(name: string): SqlTableColumnAny {
      const col = this.table.cols[`$${name}` as `$${string}`] as SqlTableColumnAny | undefined;
      if (!col) throw new SqlBuildError(`Column not found: ${name}`);
      return col;
   }

   private getEntries(context: SqlBuildContext): SqlProjectByEntry[] | null {
      const entries = resolvePath(context.params as Record<string, unknown>, this.paramName) as SqlProjectByEntry[] | null | undefined;
      if (!entries || !entries.length) return null;
      return entries;
   }
}

/**
 * Emits GROUP BY for non-aggregate columns when a `select` param has aggregates.
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

      const entries = resolvePath(context.params as Record<string, unknown>, this.paramName) as SqlProjectByEntry[] | null | undefined;
      if (!entries || !entries.length) return;

      // Collect non-aggregate columns
      const groupByCols: SqlTableColumnAny[] = [];
      let hasAggregate = false;

      for (const entry of entries) {
         if (Array.isArray(entry)) {
            hasAggregate = true;
         } else if (typeof entry === "string") {
            const col = this.table.cols[`$${entry}` as `$${string}`] as SqlTableColumnAny | undefined;
            if (col) groupByCols.push(col);
         }
      }

      if (!hasAggregate || !groupByCols.length) return;

      context.addStrings("group by ");
      for (let i = 0; i < groupByCols.length; i++) {
         if (i > 0) context.addStrings(", ");
         groupByCols[i]!.build(context);
      }
   }
}


