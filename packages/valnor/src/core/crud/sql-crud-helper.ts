import { SqlTable } from "#/core/schema/sql-table.js";
import { expand } from "#/core/query/sql-expand.js";
import { SqlInsertRowsParams } from "#/core/crud/sql-insert-rows.js";
import { getCanonicalInsertKeys } from "#/core/utils/canonical-insert-keys.js";
import { isPrimitive, Primitive } from "#/lib/primitive.js";
import { ok } from "assert";
import { sql } from "#/core/sql.js";

export function expandInsertValues<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>(
   table: SqlTable<T>,
) {
   return expand<SqlInsertRowsParams<T>>((params) => {
      const inserts = params?.rows;
      if (!inserts) return null;
      const keys = getCanonicalInsertKeys(table.cols, inserts);
      return Object.values(inserts).map((insert) => {
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
   return expand<SqlInsertRowsParams<T>>((params) => {
      const inserts = params?.rows;
      if (!inserts) return null;
      return getCanonicalInsertKeys(table.cols, inserts).map((key) => {
         const column = table.cols[`$${key}`];
         ok(column, `Table column not found by key: ${key}`);
         return column;
      });
   });
}
