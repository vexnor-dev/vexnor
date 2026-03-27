import {
   Sql,
   SqlTable,
   SqlTableColumn,
   expand,
   expandInsertValues,
   row,
   raw,
   info,
   SqlQueryAny,
   SqlTableColumnAny,
   SqlInsertRowsParams,
} from "valnor";
import { sql } from "#/mssql-sql.js";
import { MssqlQueryHandler } from "#/mssql-query-handler.js";

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
      Params: SqlInsertRowsParams<T>;
      Row: T["Select"];
   }>;

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

   const autoSetExpand = expand<SqlInsertRowsParams<T>>((params) => {
      if (!params?.rows?.length) return null;
      const insertKeySet = new Set(Object.keys(params.rows[0]!));
      const mergeColNames = new Set<string>(args.MERGE_ON.map((col) => col.columnName));
      const pairs: Sql[] = [];
      for (const colKey of Object.keys(table.cols)) {
         const col = table.cols[colKey as `$${string}`];
         if (!col || mergeColNames.has(col.columnName) || !insertKeySet.has(col.key)) continue;
         const src = new SqlTableColumn({
            key: col.key,
            columnName: col.columnName,
            tableInfo: { ...col.tableInfo, alias: "src" },
            format: "rawAlias.columnName",
         });
         pairs.push(sql`${col} = ${src}`.inline());
      }
      return sql`${pairs}`;
   });
   const setClause: Sql = args.SET?.inline() ?? autoSetExpand;

   // plain quoted column names for INSERT (...) and AS src(...)
   const plainCols = expand<SqlInsertRowsParams<T>>((params) => {
      if (!params?.rows?.length) return null;
      const insertKeySet = new Set(Object.keys(params.rows[0]!));
      return Object.keys(table.cols)
         .map((k) => k.slice(1))
         .filter((k) => insertKeySet.has(k))
         .map((key) => {
            const col = table.cols[`$${key}`]!;
            return new SqlTableColumn({
               key: col.key,
               columnName: col.columnName,
               tableInfo: col.tableInfo,
               format: "columnName",
            });
         });
   });

   // src.col references for INSERT ... VALUES (src.col1, src.col2, ...)
   const srcValueCols = expand<SqlInsertRowsParams<T>>((params) => {
      if (!params?.rows?.length) return null;
      const insertKeySet = new Set(Object.keys(params.rows[0]!));
      return Object.keys(table.cols)
         .map((k) => k.slice(1))
         .filter((k) => insertKeySet.has(k))
         .map((key) => {
            const col = table.cols[`$${key}`]!;
            return new SqlTableColumn({
               key: col.key,
               columnName: col.columnName,
               tableInfo: { ...col.tableInfo, alias: "src" },
               format: "rawAlias.columnName",
            });
         });
   });

   return sql`
      ${info({ driver: "transactsql" }) ?? raw.BLANK}
      merge into ${table}
      using (values ${expandInsertValues(table)}) as src(${plainCols})
      on (${mergeOnClause})
      when matched then
         update set ${sql`${setClause}`.inline()}
      when not matched then
         insert (${plainCols})
         values (${srcValueCols})
      output ${row(table.as`inserted`.$$)};
   ` as unknown as MssqlUpsertResult<T>;
}
