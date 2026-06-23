import { SqlTable, sql, raw, set, row, SqlUpdateParameters, Void, ParamsOfArgs, info } from "@vexnor/core";
import type { SqlUpdateArgs } from "@vexnor/core";
import { BetterSqlite3QueryHandler } from "#/better-sqlite3-query-handler.js";
import "#/sqlite3-augment.js";

export type Sqlite3TableUpdateResult<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlUpdateArgs,
> = BetterSqlite3QueryHandler<{
   Params: Void<SqlUpdateParameters<T> & ParamsOfArgs<Args>>;
   Row: T["Select"];
}>;

export function sqlite3Update<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlUpdateArgs,
>(table: SqlTable<T>, args: Args): Sqlite3TableUpdateResult<T, Args> {
   return sql`
      ${info({ driver: "sqlite" }) ?? raw.BLANK}
      update ${table}
         ${set(table)}
         ${args.WHERE ? sql`where ${args.WHERE.inline()}`.inline() : raw.BLANK}
      returning ${row(table.$$)}
   `.sqlite as unknown as Sqlite3TableUpdateResult<T, Args>;
}
