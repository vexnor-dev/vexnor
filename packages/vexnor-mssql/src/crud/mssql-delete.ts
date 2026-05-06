import { info, ParamsOfArgs, SqlDeleteArgs } from "vexnor";
import { raw, row, SqlTable } from "vexnor";
import { ok } from "vexnor/plugin";
import { sql } from "#/mssql-sql.js";
import { MssqlQueryHandler } from "#/mssql-query-handler.js";

export type MssqlDeleteResult<
   T extends { Select: Record<string, unknown>; Delete: true },
   Args extends SqlDeleteArgs,
> = MssqlQueryHandler<{
   Params: ParamsOfArgs<Args>;
   Row: T["Select"];
}>;

export function mssqlDelete<T extends { Select: Record<string, unknown>; Delete: true }, Args extends SqlDeleteArgs>(
   table: SqlTable<T>,
   args: Args,
): MssqlDeleteResult<T, Args> {
   const where = "WHERE" in args ? args.WHERE : undefined;
   if (!where) {
      ok((args as { force?: boolean }).force, "WHERE condition or force required");
   }

   return sql`
      ${info({ driver: "transactsql" }) ?? raw.BLANK}
      delete
      from ${table}
      output ${row(table.as`deleted`.$$)}
         ${where ? sql`where ${where.inline()}`.inline() : raw.BLANK}
   ` as unknown as MssqlDeleteResult<T, Args>;
}
