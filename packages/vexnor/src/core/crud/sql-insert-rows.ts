import { SqlTable } from "#/core/schema/sql-table.js";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { insert } from "#/core/query/sql-insert-x.js";
import { SqlQueryExtended } from "#/core/query/sql-query.js";
import { SqlQueryInfo } from "#/core/charms/sql-query-info.js";
import { raw } from "#/core/query/sql-raw.js";

export type SqlInsertRowsParams<T extends { Insert: Record<string, unknown> }, Field extends string> = Record<
   Field,
   T["Insert"][]
>;

export type SqlInsertRowsResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }, Field extends string> =
   SqlQueryExtended<{
      Row: T["Select"];
      Params: SqlInsertRowsParams<T, Field>;
   }>;

export function sqlInsertRows<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Field extends string = "rows",
>(
   table: SqlTable<T>,
   options: { field: Field | "rows"; info?: SqlQueryInfo | null } = { field: "rows" },
): SqlInsertRowsResult<{ Select: T["Select"]; Insert: T["Insert"] }, Field> {
   return sql`
      ${options.info ?? raw.BLANK}
      insert into ${table}
         ${insert(table, "rows")}
         returning ${row(table.$$)}
   ` as unknown as SqlInsertRowsResult<{ Select: T["Select"]; Insert: T["Insert"] }, Field>;
}
