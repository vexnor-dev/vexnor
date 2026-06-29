import { SqlTableAny } from "#src/core/schema/sql-table.js";
import { SqlBuildError } from "#src/core/sql-build-error.js";
import { SqlTableColumnAny } from "#src/core/schema/sql-table-column.js";

export function getCanonicalKeys(table: SqlTableAny, rows: Record<string, unknown>[]): string[] {
   const first = rows[0]!;
   const firstKeysSorted = Object.keys(first).sort().join(",");

   for (let i = 1; i < rows.length; i++) {
      const currentKeys = Object.keys(rows[i]!).sort().join(",");
      if (currentKeys !== firstKeysSorted) {
         throw new SqlBuildError(`Row ${i} has different columns than row 0`);
      }
   }

   for (const key of Object.keys(first)) {
      if (!table.cols[`$${key}` as `$${string}`]) {
         throw new SqlBuildError(`Column ${key} does not exist in table`);
      }
   }

   const rowKeys = Object.keys(table.cols).map((k) => k.slice(1));
   const insertKeySet = new Set(Object.keys(first));
   return rowKeys.filter((k) => insertKeySet.has(k));
}

export function getColumnMap(table: SqlTableAny): Record<string, string> {
   const map: Record<string, string> = {};
   for (const [key, col] of Object.entries(table.cols)) {
      const column = col as SqlTableColumnAny;
      map[key.slice(1)] = `"${column.columnName}"`;
   }
   return map;
}
