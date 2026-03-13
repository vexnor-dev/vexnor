import { SqlTable, expandInsertColumns, expandInsertValues, row, raw, info } from "valnor";
import { sql } from "#/postgres-sql.js";
import { SqlInsertRowsParams } from "valnor";
import { PostgresQueryHandler } from "#/postgres-query-handler.js";

export type PostgresInsertRowsResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   PostgresQueryHandler<{
      Params: SqlInsertRowsParams<T>;
      Row: T["Select"];
   }>;

export function postgresInsertRows<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>(
   table: SqlTable<T>,
): PostgresInsertRowsResult<T> {
   return sql`
      ${info({ driver: "postgres" }) ?? raw.BLANK}
      insert into ${table}
      (${expandInsertColumns(table)})
      values
      ${expandInsertValues(table)}
      returning ${row(table.$$)}
   ` as unknown as PostgresInsertRowsResult<T>;
}
