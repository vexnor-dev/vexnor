import { SqlTable, sql, raw, buildUpdateSetExpand, row, SqlUpdateParameters, Void, ParamsOfArgs, info } from "valnor";
import type { SqlUpdateArgs } from "valnor";
import { PostgresQueryHandler } from "#/postgres-query-handler.js";
import "#/valnor-postgres.js";

export type PostgresTableUpdateResult<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlUpdateArgs,
> = PostgresQueryHandler<{
   Params: Void<SqlUpdateParameters<T> & ParamsOfArgs<Args>>;
   Row: T["Select"];
}>;

export function postgresUpdate<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlUpdateArgs,
>(table: SqlTable<T>, args: Args): PostgresTableUpdateResult<T, Args> {
   return sql`
      ${info({ driver: "postgres" }) ?? raw.BLANK}
      update ${table}
         ${buildUpdateSetExpand(table)}
         ${args.WHERE ? sql`where ${args.WHERE.inline()}`.inline() : raw.BLANK}
      returning ${row(table.$$)}
   `.postgres as unknown as PostgresTableUpdateResult<T, Args>;
}
