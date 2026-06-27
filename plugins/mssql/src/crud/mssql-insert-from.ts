import { SqlTable, row, ParamsOfArgs, info, SqlQueryColumns } from "@vexnor/core";
import type { SqlInsertFromArgs } from "@vexnor/core";
import { sql } from "#src/mssql-sql.js";
import { ok } from "@vexnor/core";
import "#src/mssql-augment.js";
import { MssqlQueryHandler } from "#src/mssql-query-handler.js";

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
      ${info({ driver: "transactsql" })}
      insert into ${table}
            ${args.FROM}
            output ${row(table.as`inserted`.$$)}
   `.mssql as unknown as MssqlInsertFromResult<T, Args>;
}
