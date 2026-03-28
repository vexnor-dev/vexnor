import { AnySQLiteTable, getTableConfig } from "drizzle-orm/sqlite-core";
import { newSqlTable, SqlTableExtended } from "valnor";

type FromDrizzleResult<T extends AnySQLiteTable> = T extends {
   $inferSelect: Record<string, unknown>;
   $inferInsert: Record<string, unknown>;
}
   ? SqlTableExtended<{
        Select: T["$inferSelect"];
        Insert: T["$inferInsert"];
        Update: Partial<T["$inferInsert"]>;
        Delete: true;
     }>
   : never;

/**
 * Converts a drizzle-orm SQLite table definition into a valnor runtime table.
 *
 * @example
 * import { fromDrizzle } from 'valnor-drizzle/sqlite';
 *
 * export const Account = fromDrizzle(accountDrizzle);
 */
export function fromDrizzle<T extends AnySQLiteTable>(table: T, schema?: string): FromDrizzleResult<T> {
   const config = getTableConfig(table);

   const jsKeyBySqlName = new Map<string, string>();
   for (const [jsKey, col] of Object.entries(table)) {
      if (col !== null && typeof col === "object" && "name" in col && typeof col.name === "string") {
         jsKeyBySqlName.set(col.name, jsKey);
      }
   }

   const columns: Record<string, string> = {};
   const pk: string[] = [];

   for (const col of config.columns) {
      const jsKey = jsKeyBySqlName.get(col.name) ?? col.name;
      columns[jsKey] = col.name;
      if (col.primary) pk.push(jsKey);
   }

   for (const primaryKey of config.primaryKeys) {
      for (const col of primaryKey.columns) {
         const jsKey = jsKeyBySqlName.get(col.name) ?? col.name;
         if (!pk.includes(jsKey)) pk.push(jsKey);
      }
   }

   return newSqlTable({
      tableInfo: { name: config.name, schema: schema ?? null },
      pk,
      columns,
      dialect: "sqlite",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      crud: { select: true, insert: true, update: true, delete: true } as any,
   }) as FromDrizzleResult<T>;
}
