import { SqlTable, insert, row, info, SqlQueryColumns } from "@vexnor/core";
import { sql } from "#src/mssql-sql.js";
import { SqlInsertRowsParams } from "@vexnor/core";
import { MssqlQueryHandler } from "#src/mssql-query-handler.js";
import "#src/mssql-augment.js";

export type MssqlInsertRowsResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   MssqlQueryHandler<{
      Params: SqlInsertRowsParams<T, "rows">;
      Row: T["Select"];
   }> &
      SqlQueryColumns<T["Select"]>;

export function mssqlInsertRows<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>(
   table: SqlTable<T>,
): MssqlInsertRowsResult<T> {
   return sql`
      ${info({ driver: "transactsql" })}
      insert into ${table}
      (${insert.cols(table, "rows")})
      output ${row(table.as`inserted`.$$)}
      values
      ${insert.values(table, "rows")}
   `.mssql as unknown as MssqlInsertRowsResult<T>;
}
