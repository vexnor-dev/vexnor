import { SqlTable, expandInsertColumns, expandInsertValues, row, raw, info, sql } from "valnor";
import { SqlInsertRowsParams } from "valnor";
import { BetterSqlite3QueryHandler } from "#/better-sqlite3-query-handler.js";
import "#/valnor-sqlite3.js";

export type Sqlite3InsertRowsResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   BetterSqlite3QueryHandler<{
      Params: SqlInsertRowsParams<T>;
      Row: T["Select"];
   }>;

export function sqlite3InsertRows<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>(
   table: SqlTable<T>,
): Sqlite3InsertRowsResult<T> {
   return sql`
      ${info({ driver: "sqlite" }) ?? raw.BLANK}
      insert into ${table}
      (${expandInsertColumns(table)})
      values
      ${expandInsertValues(table)}
      returning ${row(table.$$)}
   `.sqlite as unknown as Sqlite3InsertRowsResult<T>;
}
