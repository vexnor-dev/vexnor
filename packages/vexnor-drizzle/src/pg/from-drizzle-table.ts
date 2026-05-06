import { getTableConfig, type AnyPgTable } from "drizzle-orm/pg-core";
import { newSqlTable, type SqlTableExtended } from "vexnor";

type FromDrizzleResult<T extends AnyPgTable> = T extends {
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
 * Converts a drizzle-orm PostgreSQL table definition into a vexnor runtime table.
 *
 * @example
 * import { fromDrizzleTable } from 'vexnor-drizzle/pg';
 *
 * export const Account = fromDrizzleTable(accountDrizzle);
 */
export function fromDrizzleTable<T extends AnyPgTable>(table: T, schema?: string): FromDrizzleResult<T> {
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
      tableInfo: { name: config.name, schema: schema ?? config.schema ?? null },
      pk,
      columns,
      dialect: "postgresql",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      crud: { select: true, insert: true, update: true, delete: true } as any,
   }) as FromDrizzleResult<T>;
}
