import { info, ok, ParamsOfArgs, raw, row, sql, SqlDeleteArgs, SqlDeleteCommand, SqlQueryColumns, SqlTable } from "@vexnor/core";
import { DuckDBQueryHandler } from "#src/duckdb-query-handler.js";
import "#src/duckdb-augment.js";

export type DuckDBDeleteCommandResult<
   T extends { Select: Record<string, unknown>; Delete: true },
   Args extends SqlDeleteArgs,
> = DuckDBQueryHandler<{ Params: ParamsOfArgs<Args>; Row: T["Select"] }> & SqlQueryColumns<T["Select"]>;

export class DuckDBDeleteCommand<
   T extends { Select: Record<string, unknown>; Delete: true },
   Args extends SqlDeleteArgs,
> extends SqlDeleteCommand<T, Args> {
   constructor(table: SqlTable<T>, args: Args) {
      super(table, args, info({ driver: "duckdb" }));
   }

   execute(): DuckDBDeleteCommandResult<T, Args> {
      const where = "WHERE" in this.args ? this.args.WHERE : undefined;
      if (!where) ok("force" in this.args && this.args.force, "WHERE condition or force required");
      return sql`
         ${info({ driver: "duckdb" })}
         delete from ${this.table}
         ${where ? sql`where ${where.inline()}`.inline("default") : raw.BLANK}
         returning ${row(this.table.$$)}
      `.duckdb as DuckDBDeleteCommandResult<T, Args>;
   }
}
