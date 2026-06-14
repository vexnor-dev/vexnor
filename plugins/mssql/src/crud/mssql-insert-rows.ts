import { SqlTable, expandInsertColumns, expandInsertValues, row, raw, info, SqlQueryColumns } from "vexnor";
import { sql } from "#/mssql-sql.js";
import { SqlInsertRowsParams } from "vexnor";
import { MssqlQueryHandler } from "#/mssql-query-handler.js";
import "#/mssql-augment.js";

export type MssqlInsertRowsResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   MssqlQueryHandler<{
      Params: SqlInsertRowsParams<T>;
      Row: T["Select"];
   }> &
      SqlQueryColumns<T["Select"]>;

export function mssqlInsertRows<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>(
   table: SqlTable<T>,
): MssqlInsertRowsResult<T> {
   return sql`
      ${info({ driver: "transactsql" }) ?? raw.BLANK}
      insert into ${table}
      (${expandInsertColumns(table)})
      output ${row(table.as`inserted`.$$)}
      values
      ${expandInsertValues(table)}
   `.mssql as unknown as MssqlInsertRowsResult<T>;
}
