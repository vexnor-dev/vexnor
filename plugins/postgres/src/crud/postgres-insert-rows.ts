// noinspection SqlNoDataSourceInspection,SqlResolve
import { SqlTable, insert, row, info, SqlQueryColumns } from "@vexnor/core";
import { sql } from "#/postgres-sql.js";
import { SqlInsertRowsParams } from "@vexnor/core";
import { PostgresQueryHandler } from "#/postgres-query-handler.js";
import "#/postgres-augment.js";

export type PostgresInsertRowsResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   PostgresQueryHandler<{
      Params: SqlInsertRowsParams<T, "rows">;
      Row: T["Select"];
   }> &
      SqlQueryColumns<T["Select"]>;

export function postgresInsertRows<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>(
   table: SqlTable<T>,
): PostgresInsertRowsResult<T> {
   return sql`
      ${info({ driver: "postgres" })}
      insert into ${table}
      ${insert(table, "rows")}
      returning ${row(table.$$)}
   `.postgres as unknown as PostgresInsertRowsResult<T>;
}
