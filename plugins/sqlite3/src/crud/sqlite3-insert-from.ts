import { SqlTable, row, ParamsOfArgs, SqlQueryExtended, info, sql } from "@vexnor/core";
import type { SqlInsertFromArgs } from "@vexnor/core";
import { ok } from "@vexnor/core";
import { BetterSqlite3QueryHandler } from "#src/better-sqlite3-query-handler.js";
import "#src/sqlite3-augment.js";

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
      ${info({ driver: "sqlite" })}
      insert into ${table}
            ${args.FROM}
            returning ${row(table.$$)}
   `.sqlite as unknown as Sqlite3InsertFromResult<T, Args>;
}
