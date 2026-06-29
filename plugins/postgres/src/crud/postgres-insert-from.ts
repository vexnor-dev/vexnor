import { SqlTable, ParamsOfArgs, info, SqlQueryColumns, sqlInsertFrom } from "@vexnor/core";
import type { SqlInsertFromArgs } from "@vexnor/core";
import { PostgresQueryHandler } from "#src/postgres-query-handler.js";
import "#src/postgres-augment.js";

export type PostgresInsertFromResult<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlInsertFromArgs<T>,
> = PostgresQueryHandler<{
   Row: T["Select"];
   Params: ParamsOfArgs<Args>;
}> &
   SqlQueryColumns<T["Select"]>;

export function postgresInsertFrom<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlInsertFromArgs<T>,
>(table: SqlTable<T>, args: Args): PostgresInsertFromResult<T, Args> {
   return sqlInsertFrom(table, args, info({ driver: "postgres" })).postgres as unknown as PostgresInsertFromResult<T, Args>;
}
