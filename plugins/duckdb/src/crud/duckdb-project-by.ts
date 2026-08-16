import {
   SqlBuildContext,
   SqlBuildError,
   SqlLiteralType,
   SqlProjectBy,
   type SqlProjectByEntryValue,
   type SqlProjectByFnEntry,
   SqlTableAny,
   SqlTableColumnAny,
} from "@vexnor/core";

export class DuckDBProjectBy<T extends Record<string, unknown>> extends SqlProjectBy<T> {
   constructor(table: SqlTableAny, paramName: string, fieldNames?: string[]) {
      super(table, paramName, fieldNames);
   }

   override write(context: SqlBuildContext): void {
      const select = this.duckdbGetSelectObject(context);
      if (!select) {
         super.write(context);
         return;
      }

      const entries = Object.entries(select);
      for (let index = 0; index < entries.length; index++) {
         if (index > 0) context.addStrings(", ");
         const [alias, value] = entries[index]!;
         if (value === true) {
            this.duckdbWriteColumn(context, alias, alias);
         } else if (typeof value === "string") {
            this.duckdbWriteColumn(context, value, alias);
         } else if (typeof value === "object" && value !== null && "fn" in value) {
            this.duckdbWriteFunction(context, alias, value as SqlProjectByFnEntry);
         } else {
            throw new SqlBuildError(`Invalid select entry for alias '${alias}': ${String(value)}`);
         }
      }
   }

   private duckdbWriteColumn(context: SqlBuildContext, name: string, alias: string): void {
      const column = this.duckdbResolveColumn(context, name);
      column.render("tableAlias.columnName").build(context);
      if (alias !== column.columnName) context.addStrings(` as "${escapeIdentifier(alias)}"`);
   }

   private duckdbWriteFunction(context: SqlBuildContext, alias: string, entry: SqlProjectByFnEntry): void {
      const aggregates = new Set(["sum", "count", "avg", "min", "max"]);
      if (aggregates.has(entry.fn)) {
         context.addStrings(`${entry.fn}(`);
         if (entry.col === "*") {
            context.addStrings("*");
         } else {
            const column = this.duckdbResolveColumn(context, entry.col);
            column.render("tableAlias.columnName").build(context);
            if ((entry.fn === "sum" || entry.fn === "avg") && this.duckdbIsBooleanColumn(entry.col)) {
               context.addStrings("::integer");
            }
         }
         context.addStrings(`) as "${escapeIdentifier(alias)}"`);
         return;
      }

      this.duckdbWriteTransform(context, alias, entry);
   }

   private duckdbWriteTransform(context: SqlBuildContext, alias: string, entry: SqlProjectByFnEntry): void {
      const escapedAlias = escapeIdentifier(alias);
      const writeColumn = () => this.duckdbResolveColumn(context, entry.col).render("tableAlias.columnName").build(context);

      switch (entry.fn) {
         case "dateTrunc": {
            const granularity = entry.args;
            if (typeof granularity !== "string" || !new Set(["year", "month", "day", "hour"]).has(granularity)) {
               throw new SqlBuildError(`Invalid dateTrunc granularity: "${String(granularity)}". Allowed: year, month, day, hour`);
            }
            context.addStrings(`date_trunc('${granularity}', `);
            writeColumn();
            context.addStrings(`) as "${escapedAlias}"`);
            return;
         }
         case "coalesce": {
            context.addStrings("coalesce(");
            writeColumn();
            const values = Array.isArray(entry.args) ? entry.args : [entry.args];
            for (const value of values) {
               context.addStrings(", ");
               context.addValues(value);
            }
            context.addStrings(`) as "${escapedAlias}"`);
            return;
         }
         case "round": {
            const precision = Array.isArray(entry.args) ? entry.args[0] : entry.args;
            if (precision !== undefined && precision !== null && (typeof precision !== "number" || !Number.isFinite(precision))) {
               throw new SqlBuildError(`Invalid round precision: "${String(precision)}". Must be a finite number.`);
            }
            context.addStrings("round(");
            writeColumn();
            if (precision !== undefined && precision !== null) context.addStrings(`, ${precision}`);
            context.addStrings(`) as "${escapedAlias}"`);
            return;
         }
         case "abs":
            context.addStrings("abs(");
            writeColumn();
            context.addStrings(`) as "${escapedAlias}"`);
            return;
         case "concat": {
            writeColumn();
            const values = Array.isArray(entry.args) ? entry.args : [entry.args];
            for (const value of values) {
               context.addStrings(" || ");
               context.addValues(value);
            }
            context.addStrings(` as "${escapedAlias}"`);
            return;
         }
         default:
            throw new SqlBuildError(`Unsupported transform: ${entry.fn}`);
      }
   }

   private duckdbResolveColumn(context: SqlBuildContext, name: string): SqlTableColumnAny {
      const shortName = name.split(".").pop()!;
      const column = context.columnCount > 0
         ? this.table.cols[`$${shortName}`] ?? context.getColumn(name) ?? context.getColumn(shortName)
         : this.table.cols[`$${shortName}`];
      if (!column) throw new SqlBuildError(`Column not found: ${name}`);
      return column;
   }

   private duckdbIsBooleanColumn(name: string): boolean {
      const key = name.split(".").pop()!;
      return this.table.dbSchema[key]?.type === SqlLiteralType.Boolean;
   }

   private duckdbGetSelectObject(context: SqlBuildContext): Record<string, SqlProjectByEntryValue> | null {
      let current: unknown = context.params;
      for (const segment of this.paramName.split(".")) {
         if (!current || typeof current !== "object") return null;
         current = current[segment as keyof typeof current];
      }
      if (!current || typeof current !== "object" || Array.isArray(current) || Object.keys(current).length === 0) return null;
      return current as Record<string, SqlProjectByEntryValue>;
   }
}

function escapeIdentifier(value: string): string {
   return value.replace(/"/g, '""');
}
