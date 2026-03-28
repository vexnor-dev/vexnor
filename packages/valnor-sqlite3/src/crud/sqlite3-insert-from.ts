import { SqlTable, row, ParamsOfArgs, SqlQueryExtended, raw, info, sql } from "valnor";
import type { SqlInsertFromArgs } from "valnor";
import { ok } from "valnor/plugin";
import { BetterSqlite3QueryHandler } from "#/better-sqlite3-query-handler.js";
import "#/valnor-sqlite3.js";

export type Sqlite3InsertFromResult<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlInsertFromArgs<T>,
> = BetterSqlite3QueryHandler<{
   Row: T["Select"];
   Params: ParamsOfArgs<Args>;
}> &
   SqlQueryExtended<{
      Row: T["Select"];
      Params: ParamsOfArgs<Args>;
   }>;

export function sqlite3InsertFrom<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlInsertFromArgs<T>,
>(table: SqlTable<T>, args: Args): Sqlite3InsertFromResult<T, Args> {
   ok(args?.FROM, `Args 'FROM' is required for 'insertFrom()' CRUD.`);

   return sql`
      ${info({ driver: "sqlite" }) ?? raw.BLANK}
      insert into ${table}
            ${args.FROM}
            returning ${row(table.$$)}
   `.sqlite as unknown as Sqlite3InsertFromResult<T, Args>;
}
