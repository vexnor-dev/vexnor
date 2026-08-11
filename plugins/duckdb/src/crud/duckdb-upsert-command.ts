import { info, row, SqlInsertRowsParams, SqlQueryColumns, SqlTable, SqlTableColumnAny, upsert } from "@vexnor/core";
import { DuckDBQueryHandler } from "#src/duckdb-query-handler.js";
import { sql } from "#src/duckdb-sql.js";

export type DuckDBUpsertCommandArgs = { CONFLICT_ON: SqlTableColumnAny[] };
export type DuckDBUpsertCommandResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   DuckDBQueryHandler<{ Params: SqlInsertRowsParams<T, "rows">; Row: T["Select"] }> & SqlQueryColumns<T["Select"]>;

export class DuckDBUpsertCommand<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> {
   constructor(private readonly table: SqlTable<T>, private readonly args: DuckDBUpsertCommandArgs) {}

   execute(): DuckDBUpsertCommandResult<T> {
      const conflictKeys = this.args.CONFLICT_ON.map((column) => column.key);
      return sql`
         ${info({ driver: "duckdb" })}
         insert into ${this.table}
            ${upsert(this.table, conflictKeys)}
         returning ${row(this.table.$$)}
      ` as DuckDBUpsertCommandResult<T>;
   }
}
