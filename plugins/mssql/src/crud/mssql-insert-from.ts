import { SqlTable, row, ParamsOfArgs, raw, info, SqlQueryColumns } from "vexnor";
import type { SqlInsertFromArgs } from "vexnor";
import { sql } from "#/mssql-sql.js";
import { ok } from "vexnor";
import "#/mssql-augment.js";
import { MssqlQueryHandler } from "#/mssql-query-handler.js";

export type MssqlInsertFromResult<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlInsertFromArgs<T>,
> = MssqlQueryHandler<{
   Row: T["Select"];
   Params: ParamsOfArgs<Args>;
}> &
   SqlQueryColumns<T["Select"]>;

export function mssqlInsertFrom<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlInsertFromArgs<T>,
>(table: SqlTable<T>, args: Args): MssqlInsertFromResult<T, Args> {
   ok(args?.FROM, `Args 'FROM' is required for 'insertFrom()' CRUD.`);

   return sql`
      ${info({ driver: "transactsql" }) ?? raw.BLANK}
      insert into ${table}
            ${args.FROM}
            output ${row(table.as`inserted`.$$)}
   `.mssql as unknown as MssqlInsertFromResult<T, Args>;
}
