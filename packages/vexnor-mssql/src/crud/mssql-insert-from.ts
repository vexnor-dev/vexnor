import { SqlTable, row, ParamsOfArgs, SqlQueryExtended, raw, info } from "vexnor";
import type { SqlInsertFromArgs } from "vexnor";
import { sql } from "#/mssql-sql.js";
import { ok } from "vexnor/plugin";

export type MssqlInsertFromResult<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlInsertFromArgs<T>,
> = SqlQueryExtended<{
   Row: T["Select"];
   Params: ParamsOfArgs<Args>;
}>;

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
   ` as unknown as MssqlInsertFromResult<T, Args>;
}
