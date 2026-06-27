import { SqlBuildError } from "#src/core/sql-build-error.js";
import { SqlTable } from "#src/core/schema/sql-table.js";
import { SqlInsertTypeArgs } from "#src/core/operators/sql-insert.js";
import { PARAMS, Sql, SqlOptions } from "#src/core/sql-base.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { getCanonicalKeys } from "#src/core/utils/sql-insert-utils.js";
import { BuildSqlParams, PathToNested, SqlParam } from "#src/core/query/sql-param.js";
import { ok } from "#src/lib/assert.js";
import { isPrimitive } from "#src/lib/primitive.js";
import { resolvePath } from "#src/core/query/resolve-path.js";

export class SqlInsertValues<T extends SqlInsertTypeArgs, ParamName extends string> extends Sql {
   declare readonly [PARAMS]: PathToNested<ParamName, T["Insert"] | T["Insert"][]>;

   readonly table: SqlTable<T>;
   readonly paramName: ParamName;
   readonly params: BuildSqlParams<PathToNested<ParamName, T["Insert"] | T["Insert"][]>>;

   constructor(table: SqlTable<T>, paramName: ParamName) {
      super({
         type: "SqlInsertValues",
         id: `${table.tableInfo.name}.${paramName}.values`,
         hashId: `${table.hashId}|${paramName}|values`,
      } satisfies SqlOptions);

      this.table = table;
      this.paramName = paramName;
      this.params = {
         [paramName]: new SqlParam({ name: paramName, validation: null }),
      } as BuildSqlParams<PathToNested<ParamName, T["Insert"] | T["Insert"][]>>;
   }

   write(context: SqlBuildContext): void {
      if (!context.params) {
         const keys = Object.keys(this.table.cols).map((k) => k.slice(1));
         context.addOperator({ type: "insertValues", param: this.paramName, keys });
         return;
      }

      const rows = resolvePath(context.params as Record<string, unknown>, this.paramName) as
         | Record<string, unknown>[]
         | null
         | undefined;
      if (!rows || !Array.isArray(rows) || !rows.length) { throw new SqlBuildError(`insert requires a non-empty rows array`); }

      const keys = getCanonicalKeys(this.table, rows);

      for (let r = 0; r < rows.length; r++) {
         if (r > 0) context.addStrings(", ");
         context.addStrings("(");
         for (let i = 0; i < keys.length; i++) {
            if (i > 0) context.addStrings(", ");
            const value = rows[r]![keys[i]!];
            ok(isPrimitive(value), `Value is not a primitive: ${String(value)} of ${keys[i]}`);
            context.addValues(value);
         }
         context.addStrings(")");
      }
   }
}
