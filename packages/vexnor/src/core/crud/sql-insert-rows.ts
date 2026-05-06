import { SqlTable } from "#/core/schema/sql-table.js";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { expandInsertColumns, expandInsertValues } from "#/core/crud/sql-crud-helper.js";
import { SqlQueryExtended } from "#/core/query/sql-query.js";
import { SqlQueryInfo } from "#/core/charms/sql-query-info.js";
import { raw } from "#/core/query/sql-raw.js";

export type SqlInsertRowsParams<T extends { Insert: Record<string, unknown> }> = {
   rows: T["Insert"][];
};

export type SqlInsertRowsResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   SqlQueryExtended<{
      Row: T["Select"];
      Params: SqlInsertRowsParams<T>;
   }>;

export function sqlInsertRows<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>(
   table: SqlTable<T>,
   info?: SqlQueryInfo | null,
): SqlInsertRowsResult<{ Select: T["Select"]; Insert: T["Insert"] }> {
   return sql`
      ${info ?? raw.BLANK}
      insert into ${table}
         (${expandInsertColumns(table)})
      values
      ${expandInsertValues(table)}
         returning
      ${row(table.$$)}
   ` as unknown as SqlInsertRowsResult<{ Select: T["Select"]; Insert: T["Insert"] }>;
}
