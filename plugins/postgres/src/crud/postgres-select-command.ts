import {
   Sql,
   SqlSelectCommand,
   SqlTable,
   SqlSelectArgs,
   SqlSelectHooks,
   SqlProjectBy,
   SqlBuildContext,
   SqlBuildError,
   SqlLiteralType,
   SqlTableAny,
   SqlTableColumnAny,
   SqlQueryBaseAny,
   info,
   type SqlProjectByParams,
   type SqlProjectByEntryValue,
   type SqlProjectByFnEntry,
} from "@vexnor/core";
import { jsonMany, jsonOne } from "#src/charms/json-aggregation-postgres.js";
import { PostgresQueryHandler } from "#src/postgres-query-handler.js";
import "#src/postgres-augment.js";

/**
 * PostgreSQL-aware projection node that auto-casts boolean columns to `::int`
 * when used inside SUM or AVG aggregates.
 *
 * PostgreSQL does not allow `sum(bool_col)` directly — it requires an explicit
 * cast: `sum(bool_col::int)`.
 */
export class PostgresProjectBy<T extends Record<string, unknown>> extends SqlProjectBy<T> {
   constructor(table: SqlTableAny, paramName: string, fieldNames?: string[]) {
      super(table, paramName, fieldNames);
   }

   override write(context: SqlBuildContext): void {
      if (!context.params) {
         // No params — delegate to parent (operator emission mode)
         super.write(context);
         return;
      }

      const selectObj = this.getSelectObjectFromParams(context);
      if (!selectObj) {
         // No select param — delegate to parent (emit all columns)
         super.write(context);
         return;
      }

      const entries = Object.entries(selectObj);
      for (let i = 0; i < entries.length; i++) {
         if (i > 0) context.addStrings(", ");
         const [alias, value] = entries[i]!;

         if (value === true) {
            this.pgWriteColumn(context, alias, alias);
         } else if (typeof value === "string") {
            this.pgWriteColumn(context, value, alias);
         } else if (typeof value === "object" && value !== null && "fn" in value) {
            this.pgWriteFn(context, alias, value as SqlProjectByFnEntry);
         } else {
            throw new SqlBuildError(`Invalid select entry for alias '${alias}': ${String(value)}`);
         }
      }
   }

   /**
    * Writes an aggregate function, injecting `::int` cast for boolean columns
    * when the function is `sum` or `avg`.
    */
   private pgWriteAggregate(context: SqlBuildContext, alias: string, fn: string, colRef: string): void {
      context.addStrings(`${fn}(`);
      if (colRef === "*") {
         context.addStrings("*");
      } else if (typeof colRef === "string") {
         const col = context.columnCount > 0
            ? (context.getColumn(colRef) ?? context.getColumn(colRef.split(".").pop()!) ?? this.pgResolveColumn(colRef))
            : this.pgResolveColumn(colRef);
         col.render("tableAlias.columnName").build(context);

         // Auto-cast boolean columns for sum/avg
         if ((fn === "sum" || fn === "avg") && this.isBooleanColumn(colRef)) {
            context.addStrings("::int");
         }
      } else {
         throw new SqlBuildError(`Invalid column reference in aggregate: ${String(colRef)}`);
      }
      context.addStrings(`) as "${alias.replace(/"/g, '""')}"`);
   }

   private isBooleanColumn(colRef: string): boolean {
      // Resolve the column key — strip table prefix if present
      const colKey = colRef.includes(".") ? colRef.split(".").pop()! : colRef;
      const schema = this.table.dbSchema[colKey as keyof typeof this.table.dbSchema];
      return schema?.type === SqlLiteralType.Boolean;
   }

   private pgWriteColumn(context: SqlBuildContext, name: string, alias: string): void {
      const col = context.columnCount > 0
         ? (context.getColumn(name) ?? this.pgResolveColumn(name))
         : this.pgResolveColumn(name);
      if (alias === name) {
         col.build(context);
      } else {
         col.render("tableAlias.columnName").build(context);
         context.addStrings(` as "${alias.replace(/"/g, '""')}"`);
      }
   }

   private pgWriteFn(context: SqlBuildContext, alias: string, entry: SqlProjectByFnEntry): void {
      const { fn, col: colRef } = entry;
      const aggregates = new Set(["sum", "count", "avg", "min", "max"]);
      const isAggregate = aggregates.has(fn);

      if (isAggregate) {
         this.pgWriteAggregate(context, alias, fn, colRef);
      } else {
         // For transforms, delegate to parent's write logic via a temporary approach:
         // Render just this single entry by calling super.write with a scoped select param
         this.pgWriteTransform(context, alias, entry);
      }
   }

   private pgWriteTransform(context: SqlBuildContext, alias: string, entry: SqlProjectByFnEntry): void {
      const { fn, col: colRef, args } = entry;
      const dialect = context.dialect;
      const colSql = this.pgRenderColRef(context, colRef);
      const escapedAlias = alias.replace(/"/g, '""');

      switch (fn) {
         case "dateTrunc": {
            const granularity = args as string;
            const validGranularities = new Set(["year", "month", "day", "hour"]);
            if (!validGranularities.has(granularity)) {
               throw new SqlBuildError(`Invalid dateTrunc granularity: "${granularity}". Allowed: ${[...validGranularities].join(", ")}`);
            }
            if (dialect === "sqlite") {
               const fmtMap: Record<string, string> = { year: "%Y-01-01", month: "%Y-%m-01", day: "%Y-%m-%d", hour: "%Y-%m-%d %H:00:00" };
               context.addStrings(`strftime('${fmtMap[granularity]!}', ${colSql}) as "${escapedAlias}"`);
            } else if (dialect === "transactsql" || dialect === "tsql") {
               context.addStrings(`DATETRUNC(${granularity}, ${colSql}) as "${escapedAlias}"`);
            } else {
               context.addStrings(`date_trunc('${granularity}', ${colSql}) as "${escapedAlias}"`);
            }
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

   private pgRenderColRef(context: SqlBuildContext, colRef: string): string {
      if (colRef === "*") return "*";
      const col = context.columnCount > 0
         ? (context.getColumn(colRef) ?? context.getColumn(colRef.split(".").pop()!) ?? this.pgResolveColumn(colRef))
         : this.pgResolveColumn(colRef);
      const before = context.tokens.length;
      col.render("tableAlias.columnName").build(context);
      const tokens = context.tokens.slice(before);
      const sql = tokens.map((t) => (t as { value: string }).value ?? "").join("");
      (context as unknown as { _tokens: unknown[] })._tokens.length = before;
      return sql;
   }

   private pgResolveColumn(name: string): SqlTableColumnAny {
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

   private getSelectObjectFromParams(context: SqlBuildContext): Record<string, SqlProjectByEntryValue> | null {
      const params = context.params as Record<string, unknown> | undefined;
      if (!params) return null;
      // resolvePath: for simple paramName, just access directly
      const segments = this.paramName.split(".");
      let current: unknown = params;
      for (const seg of segments) {
         if (current == null || typeof current !== "object") return null;
         current = (current as Record<string, unknown>)[seg];
      }
      const val = current as Record<string, SqlProjectByEntryValue> | null | undefined;
      if (!val || typeof val !== "object" || Object.keys(val).length === 0) return null;
      return val;
   }
}

/**
 * PostgreSQL-specific select command that:
 * 1. Handles `includeOne`/`includeMany` via lateral joins (jsonOne/jsonMany)
 * 2. Uses `PostgresProjectBy` for boolean-safe aggregates
 * 3. Passes `info({ driver: 'postgres' })` via the constructor
 * 4. Returns the `.postgres` handler
 */
export class PostgresSelectCommand<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs<T>,
> extends SqlSelectCommand<T, Args> {
   constructor(table: SqlTable<T>, args: Args) {
      const pgInfo = info({ driver: "postgres" });

      // Compute include hooks before calling super — super needs them for validation
      const { includeOne, includeMany, ...baseArgs } = args;
      const ones = Object.entries(includeOne ?? {}).map(([k, q]) => ({
         key: k,
         charm: jsonOne(q as SqlQueryBaseAny),
      }));
      const manys = Object.entries(includeMany ?? {}).map(([k, q]) => ({
         key: k,
         charm: jsonMany(q as SqlQueryBaseAny),
      }));

      const hooks: SqlSelectHooks | undefined =
         ones.length || manys.length
            ? {
                 afterSelect: [...ones, ...manys].map(({ key, charm }) => charm.as(key)),
                 afterFrom: [...ones.map(({ charm }) => charm), ...manys.map(({ charm }) => charm)],
              }
            : undefined;

      super(table, baseArgs as Args, pgInfo, undefined, undefined, hooks);
   }

   /**
    * Override to return PostgresProjectBy which auto-casts boolean columns
    * to `::int` for SUM/AVG aggregates.
    */
   protected override createProjectionNode(fieldNames: string[]): Sql {
      return new PostgresProjectBy<SqlProjectByParams<T>>(this.table as SqlTableAny, "select", fieldNames);
   }

   /**
    * Override createIncludes to provide jsonOne/jsonMany-based lateral join includes.
    * Note: In this implementation, includes are passed via hooks in the constructor,
    * so this returns null. The hook-based approach is used for compatibility with
    * the existing architecture.
    */
   protected override createIncludes(): { afterSelect: Sql[]; afterFrom: Sql[] } | null {
      return null;
   }

   /**
    * Builds the query and returns the `.postgres` handler.
    */
   buildPostgres(): PostgresQueryHandler<{
      Row: unknown;
      Params: unknown;
   }> {
      const query = this.build();
      return (query as unknown as { postgres: PostgresQueryHandler<{ Row: unknown; Params: unknown }> }).postgres;
   }
}
