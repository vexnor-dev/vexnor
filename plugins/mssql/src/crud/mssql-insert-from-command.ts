// noinspection SqlNoDataSourceInspection,SqlResolve
import {
   SqlTable,
   SqlInsertFromCommand,
   ParamsOfArgs,
   info,
   SqlQueryColumns,
   sql,
   row,
   ok,
} from "@vexnor/core";
import type { SqlInsertFromArgs } from "@vexnor/core";
import { MssqlQueryHandler } from "#src/mssql-query-handler.js";
import "#src/mssql-augment.js";

export type MssqlInsertFromCommandResult<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlInsertFromArgs<T>,
> = MssqlQueryHandler<{
   Row: T["Select"];
   Params: ParamsOfArgs<Args>;
}> &
   SqlQueryColumns<T["Select"]>;

/**
 * MSSQL-specific insert-from command.
 *
 * Uses `OUTPUT inserted.*` instead of `RETURNING *`.
 */
export class MssqlInsertFromCommand<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlInsertFromArgs<T>,
> extends SqlInsertFromCommand<T, Args> {
   constructor(table: SqlTable<T>, args: Args) {
      super(table, args, info({ driver: "transactsql" }));
   }

   execute(): MssqlInsertFromCommandResult<T, Args> {
      const { table, args } = this;
      ok(args?.FROM, `Args 'FROM' is required for 'insertFrom()' CRUD.`);

      const query = sql`
         ${info({ driver: "transactsql" })}
         insert into ${table}
               ${args.FROM}
               output ${row(table.as`inserted`.$$)}
      `;
      return query.mssql as unknown as MssqlInsertFromCommandResult<T, Args>;
   }
}
