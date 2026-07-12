// noinspection SqlNoDataSourceInspection,SqlResolve
import {
   SqlTable,
   SqlDeleteCommand,
   SqlDeleteArgs,
   ParamsOfArgs,
   info,
   SqlQueryColumns,
   sql,
   raw,
   row,
   ok,
} from "@vexnor/core";
import { MssqlQueryHandler } from "#src/mssql-query-handler.js";
import "#src/mssql-augment.js";

export type MssqlDeleteCommandResult<
   T extends { Select: Record<string, unknown>; Delete: true },
   Args extends SqlDeleteArgs,
> = MssqlQueryHandler<{
   Params: ParamsOfArgs<Args>;
   Row: T["Select"];
}> &
   SqlQueryColumns<T["Select"]>;

/**
 * MSSQL-specific delete command.
 *
 * Uses `OUTPUT deleted.*` instead of `RETURNING *`.
 */
export class MssqlDeleteCommand<
   T extends { Select: Record<string, unknown>; Delete: true },
   Args extends SqlDeleteArgs,
> extends SqlDeleteCommand<T, Args> {
   constructor(table: SqlTable<T>, args: Args) {
      super(table, args, info({ driver: "transactsql" }));
   }

   execute(): MssqlDeleteCommandResult<T, Args> {
      const { table, args } = this;
      const where = "WHERE" in args ? args.WHERE : undefined;
      if (!where) {
         ok((args as { force?: boolean }).force, "WHERE condition or force required");
      }

      const query = sql`
         ${info({ driver: "transactsql" })}
         delete
         from ${table}
         output ${row(table.as`deleted`.$$)}
            ${where ? sql`where ${where.source.inline()}`.inline() : raw.BLANK}
      `;
      return query.mssql as unknown as MssqlDeleteCommandResult<T, Args>;
   }
}
