import { info, ParamsOfArgs, SqlDeleteArgs, SqlTable, SqlQueryColumns, raw, row, sql } from "@vexnor/core";
import { ok } from "@vexnor/core";
import { PostgresQueryHandler } from "#src/postgres-query-handler.js";
import "#src/postgres-augment.js";

export type PostgresDeleteResult<
   T extends { Select: Record<string, unknown>; Delete: true },
   Args extends SqlDeleteArgs,
> = PostgresQueryHandler<{
   Params: ParamsOfArgs<Args>;
   Row: T["Select"];
}> &
   SqlQueryColumns<T["Select"]>;

export function postgresDelete<T extends { Select: Record<string, unknown>; Delete: true }, Args extends SqlDeleteArgs>(
   table: SqlTable<T>,
   args: Args,
): PostgresDeleteResult<T, Args> {
   const where = "WHERE" in args ? args.WHERE : undefined;
   if (!where) {
      ok((args as { force?: boolean }).force, "WHERE condition or force required");
   }

   return sql`
      ${info({ driver: "postgres" })}
      delete from ${table}
      ${where ? sql`where ${where.inline()}`.inline("default") : raw.BLANK}
      returning ${row(table.$$)}
   `.postgres as unknown as PostgresDeleteResult<T, Args>;
}
