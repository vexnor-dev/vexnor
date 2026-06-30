import { SqlTable, ParamsOfArgs, SqlQueryExtended, info, sqlInsertFrom } from "@vexnor/core";
import type { SqlInsertFromArgs } from "@vexnor/core";
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
   return sqlInsertFrom(table, args, info({ driver: "sqlite" })).sqlite as unknown as Sqlite3InsertFromResult<T, Args>;
}
