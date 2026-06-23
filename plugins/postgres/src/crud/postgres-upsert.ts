// noinspection SqlNoDataSourceInspection,SqlResolve
import {
   Sql,
   SqlTable,
   SqlTableColumn,
   insert,
   row,
   raw,
   info,
   SqlQueryAny,
   SqlTableColumnAny,
   excluded,
   SqlQueryColumns,
} from "@vexnor/core";
import { sql } from "#/postgres-sql.js";
import { SqlInsertRowsParams } from "@vexnor/core";
import { PostgresQueryHandler } from "#/postgres-query-handler.js";
import "#/postgres-augment.js";

/**
 * Arguments for an upsert (INSERT ... ON CONFLICT DO UPDATE) operation.
 *
 * - `CONFLICT_ON` — the columns that define the conflict target (typically the primary key or a unique index)
 * - `SET` — optional custom SET clause; defaults to updating all non-conflict columns with their `EXCLUDED` values
 */
export type PostgresUpsertArgs = {
   CONFLICT_ON: SqlTableColumnAny[];
   SET?: SqlQueryAny;
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
   const conflictCols = args.CONFLICT_ON.map(
      (col) =>
         new SqlTableColumn({
            key: col.key,
            columnName: col.columnName,
            tableInfo: col.tableInfo,
            format: "columnName",
         }),
   );
   const setClause: Sql = args.SET?.inline() ?? buildExcludedSet(table, args.CONFLICT_ON).inline();

   return sql`
      ${info({ driver: "postgres" }) ?? raw.BLANK}
      insert into ${table}
         (${insert.cols(table, "rows")})
      values
         ${insert.values(table, "rows")}
      on conflict (${conflictCols})
      do update set ${sql`${setClause}`.inline()}
      returning ${row(table.$$)}
   ` as unknown as PostgresUpsertResult<T>;
}

function buildExcludedSet<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>(
   table: SqlTable<T>,
   conflictCols: SqlTableColumnAny[],
): SqlQueryAny {
   const conflictColNames = new Set<string>(conflictCols.map((col) => col.columnName));
   const ex = excluded(table);
   const pairs: Sql[] = [];

   for (const colKey of Object.keys(table.cols)) {
      const col = table.cols[colKey as `$${string}`];
      if (!col || conflictColNames.has(col.columnName)) continue;
      pairs.push(sql`${col} = ${ex[colKey as `$${string}`]}`.inline());
   }

   return sql`${pairs}`;
}
