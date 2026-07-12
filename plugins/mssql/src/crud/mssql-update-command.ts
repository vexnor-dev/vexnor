// noinspection SqlNoDataSourceInspection,SqlResolve
import {
   SqlTable,
   SqlUpdateCommand,
   SqlUpdateParameters,
   Void,
   ParamsOfArgs,
   info,
   SqlQueryColumns,
   sql,
   raw,
   set,
   row,
} from "@vexnor/core";
import type { SqlUpdateArgs } from "@vexnor/core";
import { MssqlQueryHandler } from "#src/mssql-query-handler.js";
import "#src/mssql-augment.js";

export type MssqlUpdateCommandResult<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlUpdateArgs,
> = MssqlQueryHandler<{
   Params: Void<SqlUpdateParameters<T> & ParamsOfArgs<Args>>;
   Row: T["Select"];
}> &
   SqlQueryColumns<T["Select"]>;

/**
 * MSSQL-specific update command.
 *
 * Uses `OUTPUT inserted.*` instead of `RETURNING *`.
 */
export class MssqlUpdateCommand<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlUpdateArgs,
> extends SqlUpdateCommand<T, Args> {
   constructor(table: SqlTable<T>, args: Args) {
      super(table, args, info({ driver: "transactsql" }));
   }

   execute(): MssqlUpdateCommandResult<T, Args> {
      const { table, args } = this;

      const query = sql`
         ${info({ driver: "transactsql" })}
         update ${table}
            ${set(table)}
            output ${row(table.as`inserted`.$$)}
            ${args.WHERE ? sql`where ${args.WHERE.source.inline()}`.inline() : raw.BLANK}
      `;
      return query.mssql as unknown as MssqlUpdateCommandResult<T, Args>;
   }
}
