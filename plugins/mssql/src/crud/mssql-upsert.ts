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
 * - `SET` — optional custom SET clause for the WHEN MATCHED branch; defaults to updating all non-merge columns from the source
 */
export type MssqlUpsertArgs = {
   MERGE_ON: SqlTableColumnAny[];
   SET?: SqlQueryAny;
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
   const mergeOnClause: Sql = args.MERGE_ON.map((col) => {
      const tgt = new SqlTableColumn({
         key: col.key,
         columnName: col.columnName,
         tableInfo: col.tableInfo,
         format: "tableName.columnName",
      });
      const src = new SqlTableColumn({
         key: col.key,
         columnName: col.columnName,
         tableInfo: { ...col.tableInfo, alias: "src" },
         format: "rawAlias.columnName",
      });
      return sql`${tgt} = ${src}`.inline();
   }).reduce((acc, clause) => sql`${acc} and ${clause}`.inline());

   const setClause: Sql = args.SET?.inline() ?? buildMergeSet(table, args.MERGE_ON);

   return sql`
      ${info({ driver: "transactsql" }) ?? raw.BLANK}
      merge into ${table}
      using (values ${insert.values(table, "rows")}) as src(${insert.cols(table, "rows")})
      on (${mergeOnClause})
      when matched then
         update set ${sql`${setClause}`.inline()}
      when not matched then
         insert (${insert.cols(table, "rows")})
         values (${buildSrcCols(table, args.MERGE_ON)})
      output ${row(table.as`inserted`.$$)};
   `.mssql as unknown as MssqlUpsertResult<T>;
}

function buildMergeSet<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>(
   table: SqlTable<T>,
   mergeCols: SqlTableColumnAny[],
): Sql {
   const mergeColNames = new Set<string>(mergeCols.map((col) => col.columnName));
   const pairs: Sql[] = [];
   for (const colKey of Object.keys(table.cols)) {
      const col = table.cols[colKey as `$${string}`];
      if (!col || mergeColNames.has(col.columnName)) continue;
      const src = new SqlTableColumn({
         key: col.key,
         columnName: col.columnName,
         tableInfo: { ...col.tableInfo, alias: "src" },
         format: "rawAlias.columnName",
      });
      pairs.push(sql`${col} = ${src}`.inline());
   }
   return sql`${pairs}`;
}

function buildSrcCols<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>(
   table: SqlTable<T>,
   _mergeCols: SqlTableColumnAny[],
): Sql {
   const cols: Sql[] = [];
   for (const colKey of Object.keys(table.cols)) {
      const col = table.cols[colKey as `$${string}`];
      if (!col) continue;
      cols.push(
         new SqlTableColumn({
            key: col.key,
            columnName: col.columnName,
            tableInfo: { ...col.tableInfo, alias: "src" },
            format: "rawAlias.columnName",
         }),
      );
   }
   return sql`${cols}`;
}
