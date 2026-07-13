import {
   SqlTable,
   SqlInsertFromCommand,
   ParamsOfArgs,
   info,
   SqlQueryColumns,
} from "@vexnor/core";
import type { SqlInsertFromArgs } from "@vexnor/core";
import { PostgresQueryHandler } from "#src/postgres-query-handler.js";
import "#src/postgres-augment.js";

export type PostgresInsertFromCommandResult<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlInsertFromArgs<T>,
> = PostgresQueryHandler<{
   Row: T["Select"];
   Params: ParamsOfArgs<Args>;
}> &
   SqlQueryColumns<T["Select"]>;

/**
 * PostgreSQL-specific insert-from command.
 *
 * Delegates to core SqlInsertFromCommand.build() with postgres driver info.
 */
export class PostgresInsertFromCommand<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlInsertFromArgs<T>,
> extends SqlInsertFromCommand<T, Args> {
   constructor(table: SqlTable<T>, args: Args) {
      super(table, args, info({ driver: "postgres" }));
   }

   execute(): PostgresInsertFromCommandResult<T, Args> {
      return this.build().postgres as unknown as PostgresInsertFromCommandResult<T, Args>;
   }
}
