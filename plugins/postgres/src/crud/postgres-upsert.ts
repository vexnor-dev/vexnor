// noinspection SqlNoDataSourceInspection,SqlResolve
import {
   SqlTable,
   upsert,
   row,

   info,
   SqlTableColumnAny,
   SqlInsertRowsParams,
   SqlQueryColumns,
} from "@vexnor/core";
import { sql } from "#/postgres-sql.js";
import { PostgresQueryHandler } from "#/postgres-query-handler.js";
import "#/postgres-augment.js";

/**
 * Arguments for an upsert (INSERT ... ON CONFLICT DO UPDATE) operation.
 *
 * - `CONFLICT_ON` — the columns that define the conflict target (typically the primary key or a unique index)
 */
export type PostgresUpsertArgs = {
   CONFLICT_ON: SqlTableColumnAny[];
};

export type PostgresUpsertResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   PostgresQueryHandler<{
      Params: SqlInsertRowsParams<T, "rows">;
      Row: T["Select"];
   }> &
      SqlQueryColumns<T["Select"]>;

export function postgresUpsert<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>(
   table: SqlTable<T>,
   args: PostgresUpsertArgs,
): PostgresUpsertResult<T> {
   const conflictKeys = args.CONFLICT_ON.map((col) => col.key);

   return sql`
      ${info({ driver: "postgres" })}
      insert into ${table}
         ${upsert(table, conflictKeys)}
      returning ${row(table.$$)}
   ` as unknown as PostgresUpsertResult<T>;
}
