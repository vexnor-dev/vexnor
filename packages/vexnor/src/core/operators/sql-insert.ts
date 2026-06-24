import { PARAMS, Sql, SqlOptions } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlTable } from "#/core/schema/sql-table.js";
import { SqlTableColumnAny } from "#/core/schema/sql-table-column.js";
import { BuildSqlParams, PathToNested, SqlParam } from "#/core/query/sql-param.js";
import { ok } from "#/lib/assert.js";
import { isPrimitive } from "#/lib/primitive.js";
import { getCanonicalKeys, getColumnMap } from "#/core/utils/sql-insert-utils.js";
import { resolvePath } from "#/core/query/resolve-path.js";

export type SqlInsertTypeArgs = { Select: Record<string, unknown>; Insert: Record<string, unknown> };

export class SqlInsert<T extends SqlInsertTypeArgs, ParamName extends string> extends Sql {
   declare readonly [PARAMS]: PathToNested<ParamName, T["Insert"] | T["Insert"][]>;

   readonly table: SqlTable<T>;
   readonly paramName: ParamName;
   readonly params: BuildSqlParams<PathToNested<ParamName, T["Insert"] | T["Insert"][]>>;

   constructor(table: SqlTable<T>, paramName: ParamName) {
      super({
         type: "SqlInsert",
         id: `${table.tableInfo.name}.${paramName}`,
         hashId: `${table.hashId}|${paramName}`,
      } satisfies SqlOptions);

      this.table = table;
      this.paramName = paramName;
      this.params = {
         [paramName]: new SqlParam({ name: paramName, validation: null }),
      } as BuildSqlParams<PathToNested<ParamName, T["Insert"] | T["Insert"][]>>;
   }

   write(context: SqlBuildContext): void {
      if (!context.params) {
         context.addOperator({ type: "insert", param: this.paramName, columns: getColumnMap(this.table) });
         return;
      }

      const rows = resolvePath(context.params as Record<string, unknown>, this.paramName) as
         | Record<string, unknown>[]
         | null
         | undefined;
      if (!rows || !Array.isArray(rows) || !rows.length) return;

      const keys = getCanonicalKeys(this.table, rows);

      context.addStrings("(");
      for (let i = 0; i < keys.length; i++) {
         if (i > 0) context.addStrings(", ");
         const col = this.table.cols[`$${keys[i]}` as `$${string}`] as SqlTableColumnAny;
         context.addQuotes(col.columnName);
      }
      context.addStrings(") values ");

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
