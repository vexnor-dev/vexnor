import { getViewConfig, type MsSqlView } from "drizzle-orm/mssql-core";
import { Column } from "drizzle-orm";
import { newSqlTable, type SqlTableExtended } from "vexnor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMsSqlView = MsSqlView<string, boolean, Record<string, any>>;

type FromDrizzleViewResult<T extends AnyMsSqlView> = T extends {
   $inferSelect: Record<string, unknown>;
}
   ? SqlTableExtended<{ Select: T["$inferSelect"] }>
   : never;

/**
 * Converts a drizzle-orm MSSQL view definition into a vexnor runtime table (select-only).
 *
 * Requires drizzle-orm >= 1.0.0-beta.1. Call `.existing()` on the view builder before passing it here.
 *
 * @example
 * import { mssqlSchema, varchar } from 'drizzle-orm/mssql-core';
 * import { fromDrizzleView } from 'vexnor-drizzle/mssql';
 *
 * const accountOrderSummary = mssqlSchema('vexnor_dev')
 *   .view('account_order_summary', { accountId: varchar('account_id', { length: 36 }) })
 *   .existing();
 *
 * export const AccountOrderSummary = fromDrizzleView(accountOrderSummary);
 */
export function fromDrizzleView<T extends AnyMsSqlView>(
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
      tableInfo: { name: config.name, schema: schema ?? config.schema ?? null },
      pk: [],
      columns,
      dialect: "tsql",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      crud: { select: true, insert: false, update: false, delete: false } as any,
   }) as FromDrizzleViewResult<T>;
}
