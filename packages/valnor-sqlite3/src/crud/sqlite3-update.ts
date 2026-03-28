import { SqlTable, sql, raw, buildUpdateSetExpand, row, SqlUpdateParameters, Void, ParamsOfArgs, info } from "valnor";
import type { SqlUpdateArgs } from "valnor";
import { BetterSqlite3QueryHandler } from "#/better-sqlite3-query-handler.js";
import "#/valnor-sqlite3.js";

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
         ${buildUpdateSetExpand(table)}
         ${args.WHERE ? sql`where ${args.WHERE.inline()}`.inline() : raw.BLANK}
      returning ${row(table.$$)}
   `.sqlite as unknown as Sqlite3TableUpdateResult<T, Args>;
}
