import { info, ParamsOfArgs, SqlDeleteArgs, raw, row, SqlTable, sql } from "@vexnor/core";
import { ok } from "@vexnor/core";
import { BetterSqlite3QueryHandler } from "#/better-sqlite3-query-handler.js";
import "#/sqlite3-augment.js";

export type Sqlite3DeleteResult<
   T extends { Select: Record<string, unknown>; Delete: true },
   Args extends SqlDeleteArgs,
> = BetterSqlite3QueryHandler<{
   Params: ParamsOfArgs<Args>;
   Row: T["Select"];
}>;

export function sqlite3Delete<T extends { Select: Record<string, unknown>; Delete: true }, Args extends SqlDeleteArgs>(
   table: SqlTable<T>,
   args: Args,
): Sqlite3DeleteResult<T, Args> {
   const where = "WHERE" in args ? args.WHERE : undefined;
   if (!where) {
      ok((args as { force?: boolean }).force, "WHERE condition or force required");
   }

   return sql`
      ${info({ driver: "sqlite" })}
      delete
      from ${table}
      ${where ? sql`where ${where.inline()}`.inline("default") : raw.BLANK}
      returning ${row(table.$$)}
   `.sqlite as unknown as Sqlite3DeleteResult<T, Args>;
}
