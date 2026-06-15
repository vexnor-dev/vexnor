import { getViewConfig, type PgView } from "drizzle-orm/pg-core";
import { Column } from "drizzle-orm";
import { newSqlTable, type SqlTableExtended } from "vexnor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPgView = PgView<string, boolean, Record<string, any>>;

type FromDrizzleViewResult<T extends AnyPgView> = T extends {
   $inferSelect: Record<string, unknown>;
}
   ? SqlTableExtended<{ Select: T["$inferSelect"] }>
   : never;

/**
 * Converts a drizzle-orm PostgreSQL view definition into a vexnor runtime table (select-only).
 *
 * Call `.existing()` on the view builder before passing it here.
 *
 * @example
 * import { pgSchema, uuid, varchar } from 'drizzle-orm/pg-core';
 * import { fromDrizzleView } from '@vexnor/drizzle/pg';
 *
 * const accountOrderSummary = pgSchema('vexnor_dev')
 *   .view('account_order_summary', { accountId: uuid('account_id'), email: varchar('email') })
 *   .existing();
 *
 * export const AccountOrderSummary = fromDrizzleView(accountOrderSummary);
 */
export function fromDrizzleView<T extends AnyPgView>(
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
      dialect: "postgresql",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      crud: { select: true, insert: false, update: false, delete: false } as any,
   }) as FromDrizzleViewResult<T>;
}
