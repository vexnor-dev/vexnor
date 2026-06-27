import { PARAMS, Sql, SqlOptions } from "#src/core/sql-base.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlTable, SqlTableAny } from "#src/core/schema/sql-table.js";
import { SqlTableColumnAny } from "#src/core/schema/sql-table-column.js";
import { BuildSqlParams, PathToNested, SqlParam } from "#src/core/query/sql-param.js";
import { ok } from "#src/lib/assert.js";
import { isPrimitive } from "#src/lib/primitive.js";
import { SqlBuildError } from "#src/core/sql-build-error.js";
import { resolvePath } from "#src/core/query/resolve-path.js";

export type SqlSetTypeArgs = { Select: Record<string, unknown>; Update: Record<string, unknown> };

/**
 * Portable UPDATE SET operator. Iterates over the keys of an object parameter,
 * validates each key is a column on the table, and emits:
 *
 *   SET "col" = ?, "col" = ?
 *
 * @example
 * sql`
 *   UPDATE ${Account}
 *   ${set(Account)}
 *   WHERE ${Account.$accountId} = ${param<{ accountId: string }>('accountId')}
 * `
 * // params: { set: { email: 'jane@example.com', firstName: 'Jane' }, accountId: '...' }
 * // → SET "email" = $1, "first_name" = $2
 */
export class SqlSet<T extends SqlSetTypeArgs, ParamName extends string> extends Sql {
   declare readonly [PARAMS]: PathToNested<ParamName, Partial<T["Update"]>>;

   readonly table: SqlTable<T>;
   readonly paramName: ParamName;
   readonly params: BuildSqlParams<PathToNested<ParamName, Partial<T["Update"]>>>;

   constructor(table: SqlTable<T>, paramName: ParamName) {
      super({
         type: "SqlSet",
         id: `${table.tableInfo.name}.${paramName}`,
         hashId: `${table.hashId}|${paramName}`,
      } satisfies SqlOptions);

      this.table = table;
      this.paramName = paramName;

      // Expose param for discovery by initParams()
      const columns = Object.keys(this.table.cols).map((k) => k.slice(1));
      this.params = {
         [paramName]: new SqlParam({ name: paramName, validation: { obj: { fieldNames: columns, } } }),
      } as BuildSqlParams<PathToNested<ParamName, Partial<T["Update"]>>>;
   }

   write(context: SqlBuildContext): void {
      if (!context.params) {
         context.addOperator({
            type: "set",
            param: this.paramName,
            columns: getTableColumnMap(this.table),
         });
         return;
      }

      const obj = resolvePath(context.params as Record<string, unknown>, this.paramName) as Record<string, unknown> | null | undefined;

      if (!obj || typeof obj !== "object") {
         throw new SqlBuildError(`set() requires a non-empty object in param '${this.paramName}'`);
      }

      const entries = Object.entries(obj);
      if (!entries.length) {
         throw new SqlBuildError(`set() requires at least one column in param '${this.paramName}'`);
      }

      context.addStrings("set ");

      let emitted = 0;
      for (const [key, value] of entries) {
         const col = this.table.cols[`$${key}` as `$${string}`] as SqlTableColumnAny | undefined;
         if (!col) throw new SqlBuildError(`Column not found: ${key}`);
         ok(isPrimitive(value), `Value is not a primitive: ${String(value)}`);

         if (emitted > 0) context.addStrings(", ");
         context.addQuotes(col.columnName);
         context.addStrings(" = ");
         context.addValues(value);
         emitted++;
      }
   }
}

/**
 * UPDATE SET operator — emits `SET "col" = ?, "col" = ?` from an object param.
 *
 * Validates all keys are columns on the table. Values must be primitives.
 * The param type is inferred from the table's Update type.
 *
 * @param table - The table to resolve column names and Update type from
 * @param paramName - The dot-path parameter name (default: "set")
 */
export function set<T extends {Select: Record<string, unknown>; Update: Record<string, unknown> }, ParamName extends string | "set" = "set">(
   table: SqlTable<T & { Select: Record<string, unknown> }>,
   paramName: ParamName | "set" = "set",
): SqlSet<T, ParamName | "set"> {
   return new SqlSet(
      table,
      paramName,
   );
}

function getTableColumnMap(table: SqlTableAny): Record<string, string> {
   const map: Record<string, string> = {};
   for (const [key, col] of Object.entries(table.cols)) {
      const column = col as SqlTableColumnAny;
      map[key.slice(1)] = `"${column.columnName}"`;
   }
   return map;
}
