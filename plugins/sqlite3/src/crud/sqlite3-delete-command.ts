import {
   SqlTable,
   SqlDeleteCommand,
   SqlDeleteArgs,
   ParamsOfArgs,
   info,
   sql,
   raw,
   row,
   ok,
} from "@vexnor/core";
import { BetterSqlite3QueryHandler } from "#src/better-sqlite3-query-handler.js";
import "#src/sqlite3-augment.js";

export type Sqlite3DeleteCommandResult<
   T extends { Select: Record<string, unknown>; Delete: true },
   Args extends SqlDeleteArgs,
> = BetterSqlite3QueryHandler<{
   Params: ParamsOfArgs<Args>;
   Row: T["Select"];
}>;

/**
 * SQLite3-specific delete command.
 *
 * Uses `RETURNING *` with sqlite-specific inline formatting.
 */
export class Sqlite3DeleteCommand<
   T extends { Select: Record<string, unknown>; Delete: true },
   Args extends SqlDeleteArgs,
> extends SqlDeleteCommand<T, Args> {
   constructor(table: SqlTable<T>, args: Args) {
      super(table, args, info({ driver: "sqlite" }));
   }

   execute(): Sqlite3DeleteCommandResult<T, Args> {
      const { table, args } = this;
      const where = "WHERE" in args ? args.WHERE : undefined;
      if (!where) {
         ok((args as { force?: boolean }).force, "WHERE condition or force required");
      }

      const query = sql`
         ${info({ driver: "sqlite" })}
         delete from ${table}
         ${where ? sql`where ${where.inline()}`.inline("default") : raw.BLANK}
         returning ${row(table.$$)}
      `;
      return query.sqlite as unknown as Sqlite3DeleteCommandResult<T, Args>;
   }
}
