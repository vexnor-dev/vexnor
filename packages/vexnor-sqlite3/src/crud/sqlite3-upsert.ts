import {
   Sql,
   SqlTable,
   SqlTableColumn,
   expandInsertColumns,
   expandInsertValues,
   row,
   raw,
   info,
   SqlQueryAny,
   SqlTableColumnAny,
   excluded,
   sql,
} from "vexnor";
import { SqlInsertRowsParams } from "vexnor";
import { BetterSqlite3QueryHandler } from "#/better-sqlite3-query-handler.js";

/**
 * Arguments for an upsert (INSERT ... ON CONFLICT DO UPDATE) operation.
 *
 * - `CONFLICT_ON` — the columns that define the conflict target (typically the primary key or a unique index)
 * - `SET` — optional custom SET clause; defaults to updating all non-conflict columns with their `EXCLUDED` values
 */
export type Sqlite3UpsertArgs = {
   CONFLICT_ON: SqlTableColumnAny[];
   SET?: SqlQueryAny;
};

export type Sqlite3UpsertResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   BetterSqlite3QueryHandler<{
      Params: SqlInsertRowsParams<T>;
      Row: T["Select"];
   }>;

export function sqlite3Upsert<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>(
   table: SqlTable<T>,
   args: Sqlite3UpsertArgs,
): Sqlite3UpsertResult<T> {
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
      ${info({ driver: "sqlite" }) ?? raw.BLANK}
      insert into ${table}
         (${expandInsertColumns(table)})
      values
         ${expandInsertValues(table)}
      on conflict (${conflictCols})
      do update set ${sql`${setClause}`.inline()}
      returning ${row(table.$$)}
   `.sqlite as unknown as Sqlite3UpsertResult<T>;
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
