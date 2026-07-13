// noinspection SqlNoDataSourceInspection,SqlResolve
import {
   SqlTable,
   upsert,
   row,
   info,
   SqlTableColumnAny,
   SqlInsertRowsParams,
   sql,
   SqlQueryColumns,
} from "@vexnor/core";
import { MssqlQueryHandler } from "#src/mssql-query-handler.js";
import "#src/mssql-augment.js";

export type MssqlUpsertCommandArgs = {
   MERGE_ON: SqlTableColumnAny[];
};

export type MssqlUpsertCommandResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   MssqlQueryHandler<{
      Params: SqlInsertRowsParams<T, "rows">;
      Row: T["Select"];
   }> &
      SqlQueryColumns<T["Select"]>;

/**
 * MSSQL-specific upsert command using MERGE INTO.
 */
export class MssqlUpsertCommand<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
> {
   protected readonly table: SqlTable<T>;
   protected readonly conflictKeys: string[];

   constructor(table: SqlTable<T>, args: MssqlUpsertCommandArgs) {
      this.table = table;
      this.conflictKeys = args.MERGE_ON.map((col) => col.key);
   }

   execute(): MssqlUpsertCommandResult<T> {
      const { table, conflictKeys } = this;

      const query = sql`
         ${info({ driver: "transactsql" })}
         merge into ${table}
         ${upsert(table, conflictKeys)}
         output ${row(table.as`inserted`.$$)};
      `;
      return query.mssql as unknown as MssqlUpsertCommandResult<T>;
   }
}
