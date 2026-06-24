import { SqlTable, SqlTableAny } from "#/core/schema/sql-table.js";
import { SqlInsertTypeArgs } from "#/core/operators/sql-insert.js";
import { PARAMS, Sql, SqlOptions } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { getCanonicalKeys, getColumnMap } from "#/core/utils/sql-insert-utils.js";
import { SqlTableColumnAny } from "#/core/schema/sql-table-column.js";
import { BuildSqlParams, PathToNested, SqlParam } from "#/core/query/sql-param.js";
import { resolvePath } from "#/core/query/resolve-path.js";

/**
 * Emits source-alias-qualified column references for each column present in the insert rows.
 * Used in MERGE ... WHEN NOT MATCHED THEN INSERT ... VALUES (src."col", src."col", ...)
 *
 * @example
 * sql`VALUES (${insert.srcRefs(Account, "rows", "src")})`
 * // → VALUES ("src"."email", "src"."first_name", "src"."last_name")
 */
export class SqlInsertSrcRefs<T extends SqlInsertTypeArgs, ParamName extends string> extends Sql {
   declare readonly [PARAMS]: PathToNested<ParamName, T["Insert"] | T["Insert"][]>;

   readonly table: SqlTable<T>;
   readonly paramName: ParamName;
   readonly alias: string;
   readonly params: BuildSqlParams<PathToNested<ParamName, T["Insert"] | T["Insert"][]>>;

   constructor(table: SqlTableAny, paramName: ParamName, alias: string) {
      super({
         type: "SqlInsertSrcRefs",
         id: `${table.tableInfo.name}.${paramName}.srcRefs`,
         hashId: `${table.hashId}|${paramName}|srcRefs|${alias}`,
      } satisfies SqlOptions);

      this.table = table;
      this.paramName = paramName;
      this.alias = alias;
      this.params = {
         [paramName]: new SqlParam({ name: paramName, validation: null }),
      } as BuildSqlParams<PathToNested<ParamName, T["Insert"] | T["Insert"][]>>;
   }

   write(context: SqlBuildContext): void {
      if (!context.params) {
         context.addOperator({ type: "insertCols", param: this.paramName, columns: getColumnMap(this.table) });
         return;
      }

      const rows = resolvePath(context.params as Record<string, unknown>, this.paramName) as
         | Record<string, unknown>[]
         | null
         | undefined;
      if (!rows || !Array.isArray(rows) || !rows.length) return;

      const keys = getCanonicalKeys(this.table, rows);

      for (let i = 0; i < keys.length; i++) {
         if (i > 0) context.addStrings(", ");
         const col = this.table.cols[`$${keys[i]}` as `$${string}`] as SqlTableColumnAny;
         context.addQuotes(`${this.alias}.${col.columnName}`);
      }
   }
}
