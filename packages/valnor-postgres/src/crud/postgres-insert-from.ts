import { SqlTable, row, ParamsOfArgs, SqlQueryExtended, raw, info } from "valnor";
import type { SqlInsertFromArgs } from "valnor";
import { sql } from "#/postgres-sql.js";
import { ok } from "node:assert";

export type PostgresInsertFromResult<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlInsertFromArgs<T>,
> = SqlQueryExtended<{
   Row: T["Select"];
   Params: ParamsOfArgs<Args>;
}>;

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
   ` as unknown as PostgresInsertFromResult<T, Args>;
}
