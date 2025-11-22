import { InferTable$RowBySelect } from "../types/index.js";

export function getCanonicalInsertKeys(
   row: InferTable$RowBySelect<Record<string, unknown>>,
   inserts: Record<string, unknown>[],
): string[] {
   if (!inserts.length) throw new Error("No inserts provided");

   const firstKeys = Object.keys(inserts[0]!).sort().join(",");
   for (let i = 1; i < inserts.length; i++) {
      const currentKeys = Object.keys(inserts[i]!).sort().join(",");
      if (currentKeys !== firstKeys) {
         throw new Error(`Row ${i} has different columns than row 0`);
      }
   }

   for (const key of Object.keys(inserts[0]!)) {
      if (!row[`$${key}`]) {
         throw new Error(`Column ${key} does not exist in table`);
      }
   }

   const rowKeys = Object.keys(row).map((k) => k.slice(1));
   const insertKeySet = new Set(Object.keys(inserts[0]!));
   return rowKeys.filter((k) => insertKeySet.has(k));
}
