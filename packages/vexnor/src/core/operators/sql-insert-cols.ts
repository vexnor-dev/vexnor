import { SqlBuildError } from "#/core/sql-build-error.js";
import { SqlTable, SqlTableAny } from "#/core/schema/sql-table.js";
import { SqlInsertTypeArgs } from "#/core/operators/sql-insert.js";
import { PARAMS, Sql, SqlOptions } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { getCanonicalKeys, getColumnMap } from "#/core/utils/sql-insert-utils.js";
import { SqlTableColumnAny } from "#/core/schema/sql-table-column.js";
import { BuildSqlParams, PathToNested, SqlParam } from "#/core/query/sql-param.js";
import { resolvePath } from "#/core/query/resolve-path.js";

export class SqlInsertCols<T extends SqlInsertTypeArgs, ParamName extends string> extends Sql {
   declare readonly [PARAMS]: PathToNested<ParamName, T["Insert"] | T["Insert"][]>;

   readonly table: SqlTable<T>;
   readonly paramName: ParamName;
   readonly params: BuildSqlParams<PathToNested<ParamName, T["Insert"] | T["Insert"][]>>;

   constructor(table: SqlTableAny, paramName: ParamName) {
      super({
         type: "SqlInsertCols",
         id: `${table.tableInfo.name}.${paramName}.cols`,
         hashId: `${table.hashId}|${paramName}|cols`,
      } satisfies SqlOptions);

      this.table = table;
      this.paramName = paramName;
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
      if (!rows || !Array.isArray(rows) || !rows.length) { throw new SqlBuildError(`insert requires a non-empty rows array`); }

      const keys = getCanonicalKeys(this.table, rows);

      for (let i = 0; i < keys.length; i++) {
         if (i > 0) context.addStrings(", ");
         const col = this.table.cols[`$${keys[i]}` as `$${string}`] as SqlTableColumnAny;
         context.addQuotes(col.columnName);
      }
   }
}
