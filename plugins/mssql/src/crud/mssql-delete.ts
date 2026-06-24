// noinspection SqlNoDataSourceInspection,SqlResolve
import { info, ParamsOfArgs, sql, SqlDeleteArgs, SqlQueryColumns } from "@vexnor/core";
import { raw, row, SqlTable } from "@vexnor/core";
import { ok } from "@vexnor/core";
import { MssqlQueryHandler } from "#/mssql-query-handler.js";
import "#/mssql-augment.js";

export type MssqlDeleteResult<
   T extends { Select: Record<string, unknown>; Delete: true },
   Args extends SqlDeleteArgs,
> = MssqlQueryHandler<{
   Params: ParamsOfArgs<Args>;
   Row: T["Select"];
}> &
   SqlQueryColumns<T["Select"]>;

export function mssqlDelete<T extends { Select: Record<string, unknown>; Delete: true }, Args extends SqlDeleteArgs>(
   table: SqlTable<T>,
   args: Args,
): MssqlDeleteResult<T, Args> {
   const where = "WHERE" in args ? args.WHERE : undefined;
   if (!where) {
      ok((args as { force?: boolean }).force, "WHERE condition or force required");
   }

   return sql`
      ${info({ driver: "transactsql" })}
      delete
      from ${table}
      output ${row(table.as`deleted`.$$)}
         ${where ? sql`where ${where.source.inline()}`.inline() : raw.BLANK}
   `.mssql as unknown as MssqlDeleteResult<T, Args>;
}
