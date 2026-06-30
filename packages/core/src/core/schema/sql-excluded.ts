import { SqlTable, SqlTableAny } from "#src/core/schema/sql-table.js";
import { newSqlTableColumn } from "#src/core/schema/sql-table-column.js";
import { InferTable$RowBySelect } from "#src/core/types/infer-types.js";

const cache = new WeakMap<SqlTableAny, InferTable$RowBySelect<Record<string, unknown>>>();

/**
 * Returns a pseudo-table reference that emits `EXCLUDED.column_name` (unquoted) for use
 * in `ON CONFLICT DO UPDATE SET` clauses (PostgreSQL / SQLite) or `MERGE ... USING ... AS EXCLUDED`
 * clauses (MSSQL).
 *
 * @example
 * sql`
 *   INSERT INTO ${Account} ${Account.insertColsVals(data)}
 *   ON CONFLICT (${Account.$accountId}) DO UPDATE SET
 *     ${Account.$firstName} = ${excluded(Account).$firstName}
 * `
 */
export function excluded<T extends { Select: Record<string, unknown> }>(
   table: SqlTable<T>,
): InferTable$RowBySelect<T["Select"]> {
   const cached = cache.get(table);
   if (cached) return cached as InferTable$RowBySelect<T["Select"]>;

   const cols: Record<string, unknown> = {};
   for (const [prop, col] of Object.entries(table.cols)) {
      cols[prop] = newSqlTableColumn({
         key: col.key,
         columnName: col.columnName,
         tableInfo: { ...col.tableInfo, alias: "EXCLUDED" },
         format: "rawAlias.columnName",
      });
   }

   const result = cols as InferTable$RowBySelect<T["Select"]>;
   cache.set(table, result);
   return result;
}
