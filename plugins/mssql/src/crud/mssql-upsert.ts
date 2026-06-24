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
import { MssqlQueryHandler } from "#/mssql-query-handler.js";
import "#/mssql-augment.js";

/**
 * Arguments for an upsert (MERGE) operation.
 *
 * - `MERGE_ON` — the columns used in the `ON` clause to match existing rows (typically the primary key)
 */
export type MssqlUpsertArgs = {
   MERGE_ON: SqlTableColumnAny[];
};

export type MssqlUpsertResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   MssqlQueryHandler<{
      Params: SqlInsertRowsParams<T, "rows">;
      Row: T["Select"];
   }> &
      SqlQueryColumns<T["Select"]>;

export function mssqlUpsert<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>(
   table: SqlTable<T>,
   args: MssqlUpsertArgs,
): MssqlUpsertResult<T> {
   const conflictKeys = args.MERGE_ON.map((col) => col.key);

   return sql`
      ${info({ driver: "transactsql" })}
      merge into ${table}
      ${upsert(table, conflictKeys)}
      output ${row(table.as`inserted`.$$)};
   `.mssql as unknown as MssqlUpsertResult<T>;
}
