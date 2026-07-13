// noinspection SqlNoDataSourceInspection,SqlResolve
import {
   SqlTable,
   upsert,
   row,
   info,
   SqlTableColumnAny,
   sql,
   SqlInsertRowsParams,
} from "@vexnor/core";
import { BetterSqlite3QueryHandler } from "#src/better-sqlite3-query-handler.js";
import "#src/sqlite3-augment.js";

export type Sqlite3UpsertCommandArgs = {
   CONFLICT_ON: SqlTableColumnAny[];
};

export type Sqlite3UpsertCommandResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   BetterSqlite3QueryHandler<{
      Params: SqlInsertRowsParams<T, "rows">;
      Row: T["Select"];
   }>;

/**
 * SQLite3-specific upsert command using INSERT ... ON CONFLICT DO UPDATE.
 */
export class Sqlite3UpsertCommand<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
> {
   protected readonly table: SqlTable<T>;
   protected readonly conflictKeys: string[];

   constructor(table: SqlTable<T>, args: Sqlite3UpsertCommandArgs) {
      this.table = table;
      this.conflictKeys = args.CONFLICT_ON.map((col) => col.key);
   }

   execute(): Sqlite3UpsertCommandResult<T> {
      const { table, conflictKeys } = this;

      const query = sql`
         ${info({ driver: "sqlite" })}
         insert into ${table}
            ${upsert(table, conflictKeys)}
         returning ${row(table.$$)}
      `;
      return query.sqlite as unknown as Sqlite3UpsertCommandResult<T>;
   }
}
