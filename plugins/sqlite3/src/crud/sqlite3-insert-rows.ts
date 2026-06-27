// noinspection SqlNoDataSourceInspection,SqlResolve
import { SqlTable, insert, row, info, sql } from "@vexnor/core";
import { SqlInsertRowsParams } from "@vexnor/core";
import { BetterSqlite3QueryHandler } from "#src/better-sqlite3-query-handler.js";
import "#src/sqlite3-augment.js";

export type Sqlite3InsertRowsResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   BetterSqlite3QueryHandler<{
      Params: SqlInsertRowsParams<T, "rows">;
      Row: T["Select"];
   }>;

export function sqlite3InsertRows<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>(
   table: SqlTable<T>,
): Sqlite3InsertRowsResult<T> {
   return sql`
      ${info({ driver: "sqlite" })}
      insert into ${table}
      ${insert(table, "rows")}
      returning ${row(table.$$)}
   `.sqlite as unknown as Sqlite3InsertRowsResult<T>;
}
