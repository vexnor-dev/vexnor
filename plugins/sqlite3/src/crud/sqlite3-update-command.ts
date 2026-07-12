import {
   SqlTable,
   SqlUpdateCommand,
   SqlUpdateParameters,
   Void,
   ParamsOfArgs,
   info,
} from "@vexnor/core";
import type { SqlUpdateArgs } from "@vexnor/core";
import { BetterSqlite3QueryHandler } from "#src/better-sqlite3-query-handler.js";
import "#src/sqlite3-augment.js";

export type Sqlite3UpdateCommandResult<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlUpdateArgs,
> = BetterSqlite3QueryHandler<{
   Params: Void<SqlUpdateParameters<T> & ParamsOfArgs<Args>>;
   Row: T["Select"];
}>;

/**
 * SQLite3-specific update command.
 *
 * Uses the base `RETURNING *` via the core SqlUpdateCommand.build().
 */
export class Sqlite3UpdateCommand<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlUpdateArgs,
> extends SqlUpdateCommand<T, Args> {
   constructor(table: SqlTable<T>, args: Args) {
      super(table, args, info({ driver: "sqlite" }));
   }

   execute(): Sqlite3UpdateCommandResult<T, Args> {
      return this.build().sqlite as unknown as Sqlite3UpdateCommandResult<T, Args>;
   }
}
