import { SqlTable } from "#/core/schema/sql-table.js";
import { expand } from "#/core/query/sql-expand.js";
import { SqlInsertRowsParams } from "#/core/crud/sql-insert-rows.js";
import { getCanonicalInsertKeys } from "#/core/utils/canonical-insert-keys.js";
import { isPrimitive, Primitive } from "#/lib/primitive.js";
import { ok } from "#/lib/assert.js";
import { sql } from "#/core/sql.js";

export function expandInsertValues<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>(
   table: SqlTable<T>,
) {
   return expand<SqlInsertRowsParams<T>>({ rows: null }, ({ rows }) => {
      if (!rows) return null;
      const keys = getCanonicalInsertKeys(table.cols, rows);
      return Object.values(rows).map((insert) => {
         const values = keys.map((key): Primitive => {
            const result = insert[key];
            ok(isPrimitive(result), `Value it's not a primitive: ${result} of ${key}`);
            return result;
         });
         return sql`(${values})`;
      });
   });
}

export function expandInsertColumns<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>(
   table: SqlTable<T>,
) {
   return expand<SqlInsertRowsParams<T>>({ rows: null }, ({ rows }) => {
      if (!rows) return null;
      return getCanonicalInsertKeys(table.cols, rows).map((key) => {
         const column = table.cols[`$${key}`];
         ok(column, `Table column not found by key: ${key}`);
         return column;
      });
   });
}
