import {
   SqlTable,
   SqlInsertRowsCommand,
   SqlInsertRowsParams,
   info,
   SqlQueryColumns,
} from "@vexnor/core";
import { PostgresQueryHandler } from "#src/postgres-query-handler.js";
import "#src/postgres-augment.js";

export type PostgresInsertRowsCommandResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   PostgresQueryHandler<{
      Params: SqlInsertRowsParams<T, "rows">;
      Row: T["Select"];
   }> &
      SqlQueryColumns<T["Select"]>;

/**
 * PostgreSQL-specific insert rows command.
 *
 * Delegates to core sqlInsertRows with postgres driver info, then returns the .postgres handler.
 */
export class PostgresInsertRowsCommand<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
> extends SqlInsertRowsCommand<T> {
   constructor(table: SqlTable<T>) {
      super(table, info({ driver: "postgres" }));
   }

   execute(): PostgresInsertRowsCommandResult<T> {
      return this.build().postgres as unknown as PostgresInsertRowsCommandResult<T>;
   }
}
