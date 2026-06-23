// noinspection SqlNoDataSourceInspection,SqlResolve
import {
   Sql,
   SqlTable,
   SqlTableColumn,
   SqlBuildContext,
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
         values (${buildSrcCols(table)})
      output ${row(table.as`inserted`.$$)};
   `.mssql as unknown as MssqlUpsertResult<T>;
}

function buildMergeSet<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>(
   table: SqlTable<T>,
   mergeCols: SqlTableColumnAny[],
): Sql {
   return new SqlMergeAutoSet(table, mergeCols);
}

class SqlMergeAutoSet<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> extends Sql {
   private readonly table: SqlTable<T>;
   private readonly mergeCols: SqlTableColumnAny[];

   constructor(table: SqlTable<T>, mergeCols: SqlTableColumnAny[]) {
      super({ type: "SqlMergeAutoSet", id: `${table.tableInfo.name}.mergeSet`, hashId: `${table.hashId}|mergeSet` });
      this.table = table;
      this.mergeCols = mergeCols;
   }

   write(context: SqlBuildContext): void {
      const rows = (context.params as Record<string, unknown> | undefined)?.rows as Record<string, unknown>[] | undefined;
      if (!rows?.length) return;

      const insertKeySet = new Set(Object.keys(rows[0]!));
      const mergeColNames = new Set<string>(this.mergeCols.map((col) => col.columnName));
      const tableKeys = Object.keys(this.table.cols).map((k) => k.slice(1));
      const keys = tableKeys.filter((k) => insertKeySet.has(k) && !mergeColNames.has(this.table.cols[`$${k}` as `$${string}`]!.columnName));

      for (let i = 0; i < keys.length; i++) {
         if (i > 0) context.addStrings(", ");
         const col = this.table.cols[`$${keys[i]}` as `$${string}`] as SqlTableColumnAny;
         context.addQuotes(col.columnName);
         context.addStrings(` = src.`);
         context.addQuotes(col.columnName);
      }
   }
}

function buildSrcCols<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>(
   table: SqlTable<T>,
): Sql {
   return new SqlMergeSrcCols(table);
}

class SqlMergeSrcCols<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> extends Sql {
   private readonly table: SqlTable<T>;

   constructor(table: SqlTable<T>) {
      super({ type: "SqlMergeSrcCols", id: `${table.tableInfo.name}.srcCols`, hashId: `${table.hashId}|srcCols` });
      this.table = table;
   }

   write(context: SqlBuildContext): void {
      const rows = (context.params as Record<string, unknown> | undefined)?.rows as Record<string, unknown>[] | undefined;
      if (!rows?.length) return;

      const insertKeySet = new Set(Object.keys(rows[0]!));
      const tableKeys = Object.keys(this.table.cols).map((k) => k.slice(1));
      const keys = tableKeys.filter((k) => insertKeySet.has(k));

      for (let i = 0; i < keys.length; i++) {
         if (i > 0) context.addStrings(", ");
         const col = this.table.cols[`$${keys[i]}` as `$${string}`] as SqlTableColumnAny;
         context.addStrings(`src."${col.columnName}"`);
      }
   }
}
