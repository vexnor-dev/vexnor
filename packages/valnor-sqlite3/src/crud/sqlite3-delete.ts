import { info, ParamsOfArgs, SqlDeleteArgs, raw, row, SqlTable, sql } from "valnor";
import { ok } from "valnor/plugin";
import { BetterSqlite3QueryHandler } from "#/better-sqlite3-query-handler.js";
import "#/valnor-sqlite3.js";

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
      ${info({ driver: "sqlite" }) ?? raw.BLANK}
      delete
      from ${table}
      ${where ? sql`where ${where.inline()}`.inline("default") : raw.BLANK}
      returning ${row(table.$$)}
   `.sqlite3 as unknown as Sqlite3DeleteResult<T, Args>;
}
