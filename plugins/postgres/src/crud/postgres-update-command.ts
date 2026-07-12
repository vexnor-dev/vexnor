import {
   SqlTable,
   SqlUpdateCommand,
   SqlUpdateParameters,
   Void,
   ParamsOfArgs,
   info,
   SqlQueryColumns,
} from "@vexnor/core";
import type { SqlUpdateArgs } from "@vexnor/core";
import { PostgresQueryHandler } from "#src/postgres-query-handler.js";
import "#src/postgres-augment.js";

export type PostgresUpdateCommandResult<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlUpdateArgs,
> = PostgresQueryHandler<{
   Params: Void<SqlUpdateParameters<T> & ParamsOfArgs<Args>>;
   Row: T["Select"];
}> &
   SqlQueryColumns<T["Select"]>;

/**
 * PostgreSQL-specific update command.
 *
 * Uses the base `RETURNING *` via the core SqlUpdateCommand.build().
 */
export class PostgresUpdateCommand<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlUpdateArgs,
> extends SqlUpdateCommand<T, Args> {
   constructor(table: SqlTable<T>, args: Args) {
      super(table, args, info({ driver: "postgres" }));
   }

   execute(): PostgresUpdateCommandResult<T, Args> {
      return this.build().postgres as unknown as PostgresUpdateCommandResult<T, Args>;
   }
}
