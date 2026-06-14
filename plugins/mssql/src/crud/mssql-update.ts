import {
   SqlTable,
   sql,
   raw,
   buildUpdateSetExpand,
   row,
   SqlUpdateParameters,
   Void,
   ParamsOfArgs,
   info,
   SqlQueryColumns,
} from "vexnor";
import type { SqlUpdateArgs } from "vexnor";
import { MssqlQueryHandler } from "#/mssql-query-handler.js";
import "#/mssql-augment.js";

export type MssqlTableUpdateResult<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlUpdateArgs,
> = MssqlQueryHandler<{
   Params: Void<SqlUpdateParameters<T> & ParamsOfArgs<Args>>;
   Row: T["Select"];
}> &
   SqlQueryColumns<T["Select"]>;

export function mssqlUpdate<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlUpdateArgs,
>(table: SqlTable<T>, args: Args): MssqlTableUpdateResult<T, Args> {
   return sql`
      ${info({ driver: "transactsql" }) ?? raw.BLANK}
      update ${table}
         ${buildUpdateSetExpand(table)}
         output ${row(table.as`inserted`.$$)}
         ${args.WHERE ? sql`where ${args.WHERE.source.inline()}`.inline() : raw.BLANK}
   `.mssql as unknown as MssqlTableUpdateResult<T, Args>;
}
