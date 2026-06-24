import { getViewConfig, type SQLiteView, type SQLiteViewWithSelection } from "drizzle-orm/sqlite-core";
import { newSqlTable, type SqlTableExtended } from "@vexnor/core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySQLiteView = SQLiteView<string, boolean, Record<string, any>> | SQLiteViewWithSelection<any, any, any>;

type FromDrizzleViewResult<T extends AnySQLiteView> = T extends {
   $inferSelect: Record<string, unknown>;
}
   ? SqlTableExtended<{ Select: T["$inferSelect"] }>
   : never;

/**
 * Converts a drizzle-orm SQLite view definition into a vexnor runtime table (select-only).
 *
 * Call `.existing()` on the view builder before passing it here.
 *
 * @example
 * import { sqliteView, text } from 'drizzle-orm/sqlite-core';
 * import { fromDrizzleView } from '@vexnor/drizzle/sqlite';
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
   const config = getViewConfig(view as SQLiteView<string, boolean, Record<string, any>>);

   if (!config.name) {
      throw new Error(
         `fromDrizzleView: received a view builder instead of a view. Call .existing() or .as(sql\`...\`) on the view definition first.`,
      );
   }

   const columns: Record<string, string> = {};
   for (const [jsKey, col] of Object.entries(config.selectedFields)) {
      if (col !== null && typeof col === "object" && "name" in col && typeof col.name === "string" && "columnType" in col) {
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
