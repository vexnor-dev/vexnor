// noinspection SqlNoDataSourceInspection,SqlResolve
import {
   SqlTable,
   upsert,
   row,

   info,
   SqlTableColumnAny,
   sql,
} from "@vexnor/core";
import { SqlInsertRowsParams } from "@vexnor/core";
import { BetterSqlite3QueryHandler } from "#src/better-sqlite3-query-handler.js";
import "#src/sqlite3-augment.js";

/**
 * Arguments for an upsert (INSERT ... ON CONFLICT DO UPDATE) operation.
 *
 * - `CONFLICT_ON` — the columns that define the conflict target (typically the primary key or a unique index)
 */
export type Sqlite3UpsertArgs = {
   CONFLICT_ON: SqlTableColumnAny[];
};

export type Sqlite3UpsertResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   BetterSqlite3QueryHandler<{
      Params: SqlInsertRowsParams<T, "rows">;
      Row: T["Select"];
   }>;

export function sqlite3Upsert<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>(
   table: SqlTable<T>,
   args: Sqlite3UpsertArgs,
): Sqlite3UpsertResult<T> {
   const conflictKeys = args.CONFLICT_ON.map((col) => col.key);

   return sql`
      ${info({ driver: "sqlite" })}
      insert into ${table}
         ${upsert(table, conflictKeys)}
      returning ${row(table.$$)}
   `.sqlite as unknown as Sqlite3UpsertResult<T>;
}
