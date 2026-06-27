import {
   SqlTable,
   sql,
   raw,
   set,
   row,
   SqlUpdateParameters,
   Void,
   ParamsOfArgs,
   info,
   SqlQueryColumns,
} from "@vexnor/core";
import type { SqlUpdateArgs } from "@vexnor/core";
import { PostgresQueryHandler } from "#src/postgres-query-handler.js";
import "#src/postgres-augment.js";

export type PostgresTableUpdateResult<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlUpdateArgs,
> = PostgresQueryHandler<{
   Params: Void<SqlUpdateParameters<T> & ParamsOfArgs<Args>>;
   Row: T["Select"];
}> &
   SqlQueryColumns<T["Select"]>;

export function postgresUpdate<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlUpdateArgs,
>(table: SqlTable<T>, args: Args): PostgresTableUpdateResult<T, Args> {
   return sql`
      ${info({ driver: "postgres" })}
      update ${table}
         ${set(table)}
         ${args.WHERE ? sql`where ${args.WHERE.inline()}`.inline() : raw.BLANK}
      returning ${row(table.$$)}
   `.postgres as unknown as PostgresTableUpdateResult<T, Args>;
}
