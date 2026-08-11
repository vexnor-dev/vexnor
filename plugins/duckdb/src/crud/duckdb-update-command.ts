import { info, ParamsOfArgs, SqlQueryColumns, SqlTable, SqlUpdateArgs, SqlUpdateCommand, SqlUpdateParameters, Void } from "@vexnor/core";
import { DuckDBQueryHandler } from "#src/duckdb-query-handler.js";
import "#src/duckdb-augment.js";

export type DuckDBUpdateCommandResult<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlUpdateArgs,
> = DuckDBQueryHandler<{ Params: Void<SqlUpdateParameters<T> & ParamsOfArgs<Args>>; Row: T["Select"] }> & SqlQueryColumns<T["Select"]>;

export class DuckDBUpdateCommand<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlUpdateArgs,
> extends SqlUpdateCommand<T, Args> {
   constructor(table: SqlTable<T>, args: Args) {
      super(table, args, info({ driver: "duckdb" }));
   }

   execute(): DuckDBUpdateCommandResult<T, Args> {
      return this.build().duckdb as DuckDBUpdateCommandResult<T, Args>;
   }
}
