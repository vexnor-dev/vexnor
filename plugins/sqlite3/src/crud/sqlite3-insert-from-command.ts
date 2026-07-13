import {
   SqlTable,
   SqlInsertFromCommand,
   ParamsOfArgs,
   info,
} from "@vexnor/core";
import type { SqlInsertFromArgs } from "@vexnor/core";
import { BetterSqlite3QueryHandler } from "#src/better-sqlite3-query-handler.js";
import "#src/sqlite3-augment.js";

export type Sqlite3InsertFromCommandResult<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlInsertFromArgs<T>,
> = BetterSqlite3QueryHandler<{
   Row: T["Select"];
   Params: ParamsOfArgs<Args>;
}>;

/**
 * SQLite3-specific insert-from command.
 *
 * Delegates to core SqlInsertFromCommand.build() with sqlite driver info.
 */
export class Sqlite3InsertFromCommand<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlInsertFromArgs<T>,
> extends SqlInsertFromCommand<T, Args> {
   constructor(table: SqlTable<T>, args: Args) {
      super(table, args, info({ driver: "sqlite" }));
   }

   execute(): Sqlite3InsertFromCommandResult<T, Args> {
      return this.build().sqlite as unknown as Sqlite3InsertFromCommandResult<T, Args>;
   }
}
