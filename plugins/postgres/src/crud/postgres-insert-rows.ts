// noinspection SqlNoDataSourceInspection,SqlResolve
import { SqlTable, expandInsertColumns, expandInsertValues, row, raw, info, SqlQueryColumns } from "vexnor";
import { sql } from "#/postgres-sql.js";
import { SqlInsertRowsParams } from "vexnor";
import { PostgresQueryHandler } from "#/postgres-query-handler.js";
import "#/postgres-augment.js";

export type PostgresInsertRowsResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   PostgresQueryHandler<{
      Params: SqlInsertRowsParams<T>;
      Row: T["Select"];
   }> &
      SqlQueryColumns<T["Select"]>;

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
   `.postgres as unknown as PostgresInsertRowsResult<T>;
}
