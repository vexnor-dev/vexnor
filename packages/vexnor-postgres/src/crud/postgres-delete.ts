import { info, ParamsOfArgs, SqlDeleteArgs, raw, row, SqlTable } from "vexnor";
import { ok } from "vexnor";
import { sql } from "#/postgres-sql.js";
import { PostgresQueryHandler } from "#/postgres-query-handler.js";
import "#/postgres-augment.js";

export type PostgresDeleteResult<
   T extends { Select: Record<string, unknown>; Delete: true },
   Args extends SqlDeleteArgs,
> = PostgresQueryHandler<{
   Params: ParamsOfArgs<Args>;
   Row: T["Select"];
}>;

export function postgresDelete<
   T extends { Select: Record<string, unknown>; Delete: true },
   Args extends SqlDeleteArgs,
>(table: SqlTable<T>, args: Args): PostgresDeleteResult<T, Args> {
   const where = "WHERE" in args ? args.WHERE : undefined;
   if (!where) {
      ok((args as { force?: boolean }).force, "WHERE condition or force required");
   }

   return sql`
      ${info({ driver: "postgres" }) ?? raw.BLANK}
      delete
      from ${table}
      ${where ? sql`where ${where.inline()}`.inline("default") : raw.BLANK}
      returning ${row(table.$$)}
   ` as unknown as PostgresDeleteResult<T, Args>;
}
