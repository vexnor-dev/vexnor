import {
   SqlTable,
   SqlInsertRowsCommand,
   SqlInsertRowsParams,
   info,
} from "@vexnor/core";
import { BetterSqlite3QueryHandler } from "#src/better-sqlite3-query-handler.js";
import "#src/sqlite3-augment.js";

export type Sqlite3InsertRowsCommandResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   BetterSqlite3QueryHandler<{
      Params: SqlInsertRowsParams<T, "rows">;
      Row: T["Select"];
   }>;

/**
 * SQLite3-specific insert rows command.
 *
 * Delegates to core SqlInsertRowsCommand.build() with sqlite driver info.
 */
export class Sqlite3InsertRowsCommand<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
> extends SqlInsertRowsCommand<T> {
   constructor(table: SqlTable<T>) {
      super(table, info({ driver: "sqlite" }));
   }

   execute(): Sqlite3InsertRowsCommandResult<T> {
      return this.build().sqlite as unknown as Sqlite3InsertRowsCommandResult<T>;
   }
}
