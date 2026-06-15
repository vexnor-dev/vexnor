import { SqlTable, row, ParamsOfArgs, raw, info, SqlQueryColumns } from "@vexnor/core";
import type { SqlInsertFromArgs } from "@vexnor/core";
import { sql } from "#/postgres-sql.js";
import { ok } from "@vexnor/core";
import { PostgresQueryHandler } from "#/postgres-query-handler.js";
import "#/postgres-augment.js";

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
   ok(args?.FROM, `Args 'FROM' is required for 'insertFrom()' CRUD.`);

   return sql`
      ${info({ driver: "postgres" }) ?? raw.BLANK}
      insert into ${table}
            ${args.FROM}
            returning ${row(table.$$)}
   `.postgres as unknown as PostgresInsertFromResult<T, Args>;
}
