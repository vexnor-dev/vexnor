import { getViewConfig, type SQLiteView } from "drizzle-orm/sqlite-core";
import { Column } from "drizzle-orm";
import { newSqlTable, type SqlTableExtended } from "valnor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySQLiteView = SQLiteView<string, boolean, Record<string, any>>;

type FromDrizzleViewResult<T extends AnySQLiteView> = T extends {
   $inferSelect: Record<string, unknown>;
}
   ? SqlTableExtended<{ Select: T["$inferSelect"] }>
   : never;

/**
 * Converts a drizzle-orm SQLite view definition into a valnor runtime table (select-only).
 *
 * Call `.existing()` on the view builder before passing it here.
 *
 * @example
 * import { sqliteView, text } from 'drizzle-orm/sqlite-core';
 * import { fromDrizzleView } from 'valnor-drizzle/sqlite';
 *
 * const accountOrderSummary = sqliteView('account_order_summary', {
 *   accountId: text('account_id'),
 *   email: text('email'),
 * }).existing();
 *
 * export const AccountOrderSummary = fromDrizzleView(accountOrderSummary);
 */
export function fromDrizzleView<T extends AnySQLiteView>(
   view: T,
   schema?: string,
): FromDrizzleViewResult<T> {
   const config = getViewConfig(view);

   if (!config.name) {
      throw new Error(
         `fromDrizzleView: received a view builder instead of a view. Call .existing() or .as(sql\`...\`) on the view definition first.`,
      );
   }

   const columns: Record<string, string> = {};
   for (const [jsKey, col] of Object.entries(config.selectedFields)) {
      if (col instanceof Column) {
         columns[jsKey] = col.name;
      }
   }

   return newSqlTable({
      tableInfo: { name: config.name, schema: schema ?? null },
      pk: [],
      columns,
      dialect: "sqlite",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      crud: { select: true, insert: false, update: false, delete: false } as any,
   }) as FromDrizzleViewResult<T>;
}
