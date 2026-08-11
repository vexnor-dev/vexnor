import { info, ParamsOfArgs, SqlInsertFromArgs, SqlInsertFromCommand, SqlQueryColumns, SqlTable } from "@vexnor/core";
import { DuckDBQueryHandler } from "#src/duckdb-query-handler.js";
import "#src/duckdb-augment.js";

export type DuckDBInsertFromCommandResult<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlInsertFromArgs<T>,
> = DuckDBQueryHandler<{ Row: T["Select"]; Params: ParamsOfArgs<Args> }> & SqlQueryColumns<T["Select"]>;

export class DuckDBInsertFromCommand<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlInsertFromArgs<T>,
> extends SqlInsertFromCommand<T, Args> {
   constructor(table: SqlTable<T>, args: Args) {
      super(table, args, info({ driver: "duckdb" }));
   }

   execute(): DuckDBInsertFromCommandResult<T, Args> {
      return this.build().duckdb as DuckDBInsertFromCommandResult<T, Args>;
   }
}
