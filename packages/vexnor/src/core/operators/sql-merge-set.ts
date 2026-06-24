import { SqlTable, SqlTableAny } from "#/core/schema/sql-table.js";
import { SqlInsertTypeArgs } from "#/core/operators/sql-insert.js";
import { PARAMS, Sql, SqlOptions } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { getCanonicalKeys, getColumnMap } from "#/core/utils/sql-insert-utils.js";
import { SqlTableColumnAny } from "#/core/schema/sql-table-column.js";
import { BuildSqlParams, PathToNested, SqlParam } from "#/core/query/sql-param.js";
import { resolvePath } from "#/core/query/resolve-path.js";

/**
 * Emits `"col" = "alias"."col"` for each non-merge column present in the insert rows.
 * Used in MERGE ... WHEN MATCHED THEN UPDATE SET ...
 *
 * Follows the same dual-path pattern as SqlInsertCols:
 * - No params (serialization): emits a `set` operator token
 * - With params (build): resolves rows, filters to non-merge insert columns, emits SQL
 *
 * @example
 * sql`UPDATE SET ${new SqlMergeSet(Account, [Account.$accountId], "rows", "src")}`
 * // → UPDATE SET "email" = "src"."email", "first_name" = "src"."first_name"
 */
export class SqlMergeSet<T extends SqlInsertTypeArgs, ParamName extends string> extends Sql {
   declare readonly [PARAMS]: PathToNested<ParamName, T["Insert"] | T["Insert"][]>;

   readonly table: SqlTable<T>;
   readonly mergeCols: SqlTableColumnAny[];
   readonly paramName: ParamName;
   readonly alias: string;
   readonly params: BuildSqlParams<PathToNested<ParamName, T["Insert"] | T["Insert"][]>>;

   constructor(table: SqlTableAny, mergeCols: SqlTableColumnAny[], paramName: ParamName, alias: string) {
      super({
         type: "SqlMergeSet",
         id: `${table.tableInfo.name}.${paramName}.mergeSet`,
         hashId: `${table.hashId}|${paramName}|mergeSet|${alias}`,
      } satisfies SqlOptions);

      this.table = table;
      this.mergeCols = mergeCols;
      this.paramName = paramName;
      this.alias = alias;
      this.params = {
         [paramName]: new SqlParam({ name: paramName, validation: null }),
      } as BuildSqlParams<PathToNested<ParamName, T["Insert"] | T["Insert"][]>>;
   }

   write(context: SqlBuildContext): void {
      if (!context.params) {
         context.addOperator({ type: "set", param: this.paramName, columns: getColumnMap(this.table) });
         return;
      }

      const rows = resolvePath(context.params as Record<string, unknown>, this.paramName) as
         | Record<string, unknown>[]
         | null
         | undefined;
      if (!rows || !Array.isArray(rows) || !rows.length) return;

      const keys = getCanonicalKeys(this.table, rows);
      const mergeColNames = new Set<string>(this.mergeCols.map((col) => col.columnName));
      const setKeys = keys.filter((k) => {
         const col = this.table.cols[`$${k}` as `$${string}`] as SqlTableColumnAny;
         return !mergeColNames.has(col.columnName);
      });

      for (let i = 0; i < setKeys.length; i++) {
         if (i > 0) context.addStrings(", ");
         const col = this.table.cols[`$${setKeys[i]}` as `$${string}`] as SqlTableColumnAny;
         context.addQuotes(col.columnName);
         context.addStrings(" = ");
         context.addQuotes(`${this.alias}.${col.columnName}`);
      }
   }
}
