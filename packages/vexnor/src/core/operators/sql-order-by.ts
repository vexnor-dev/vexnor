import { PARAMS, Sql, SqlOptions } from "#src/core/sql-base.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlTable } from "#src/core/schema/sql-table.js";
import { SqlTableColumnAny } from "#src/core/schema/sql-table-column.js";
import { BuildSqlParams, PathToNested, SqlParam } from "#src/core/query/sql-param.js";
import { SqlBuildError } from "#src/core/sql-build-error.js";
import { resolvePath } from "#src/core/query/resolve-path.js";

const VALID_DIRECTIONS = new Set(["asc", "desc", "ASC", "DESC"]);

/**
 * OrderBy param shape: `{ colName: "ASC" | "DESC", ... }`
 * Key order determines sort priority.
 */
export type SqlOrderByOption<T extends Record<string, unknown> = Record<string, unknown>> = {
   [K in keyof T]?: "ASC" | "DESC" | "asc" | "desc";
};

export type SqlOrderByParams<T extends { Select: Record<string, unknown> }, ParamName extends string> = PathToNested<
   ParamName,
   SqlOrderByOption<T["Select"]> | null | undefined
>;

/**
 * Portable ORDER BY operator. At runtime, accepts an object `{ col: dir, ... }`.
 * Key order determines sort priority. Omit the param or pass null for no ORDER BY.
 *
 * @example
 * sql`SELECT ${row(Account.$$)} FROM ${Account} ${orderBy(Account)}`
 *
 * // params: { orderBy: { email: "DESC", createdAt: "ASC" } }
 * // → ORDER BY "email" DESC, "created_at" ASC
 *
 * // params: { orderBy: null }  — no ORDER BY
 */
export class SqlOrderBy<T extends { Select: Record<string, unknown> }, ParamName extends string> extends Sql {
   declare readonly [PARAMS]: SqlOrderByParams<T, ParamName>;

   readonly table: SqlTable<T>;
   readonly paramName: ParamName;
   readonly params: BuildSqlParams<PathToNested<ParamName, T[keyof T]>>;

   constructor(table: SqlTable<T>, { paramName }: { paramName: ParamName }) {
      super({
         type: "SqlOrderBy",
         id: `${table.tableInfo.name}.${paramName}`,
         hashId: `${table.hashId}|${paramName}`,
      } satisfies SqlOptions);

      this.table = table;
      this.paramName = paramName;
      this.params = {
         [paramName]: new SqlParam<{ Name: ParamName; Type: SqlOrderByOption<T["Select"]> }>({
            name: paramName,
            validation: {
               obj: {
                  fieldNames: table.colKeys,
                  fieldValues: ["ASC", "DESC", "asc", "desc"],
               },
            },
            isContext: false,
         }),
      } as BuildSqlParams<PathToNested<ParamName, T[keyof T]>>;
   }

   write(context: SqlBuildContext): void {
      if (!context.params) {
         const columns: Record<string, string> = {};
         for (const [key, col] of Object.entries(this.table.cols)) {
            const column = col as SqlTableColumnAny;
            const before = context.tokens.length;
            column.build(context);
            const added = context.tokens
               .slice(before)
               .map((t) => (t as { value: string }).value ?? "")
               .join("");
            (context as unknown as { _tokens: unknown[] })._tokens.length = before;
            columns[key.slice(1)] = added;
         }
         context.addOperator({ type: "orderBy", param: this.paramName, columns });
         return;
      }

      const orderByParam = resolvePath(context.params as Record<string, unknown>, this.paramName) as
         | Record<string, string>
         | null
         | undefined;
      if (!orderByParam || typeof orderByParam !== "object") return;

      const entries = Object.entries(orderByParam);
      if (!entries.length) return;

      context.addStrings("order by ");

      let emitted = 0;
      for (const [field, dir] of entries) {
         const col = this.table.cols[`$${field}` as `$${string}`] as SqlTableColumnAny | undefined;
         if (!col) throw new SqlBuildError(`Column not found for orderBy: ${field}`);

         if (dir && !VALID_DIRECTIONS.has(dir)) {
            throw new SqlBuildError(`Invalid order direction: ${dir}. Must be 'asc' or 'desc'.`);
         }

         if (emitted > 0) context.addStrings(", ");
         col.build(context);
         context.addStrings(` ${dir ? dir.toUpperCase() : "ASC"}`);
         emitted++;
      }
   }
}

/**
 * ORDER BY operator — emits `ORDER BY "col" DIR, ...` from a runtime param.
 *
 * @param table - The table to resolve column names from
 * @param paramName - The dot-path parameter name (default: "orderBy")
 */
export function orderBy<
   T extends { Select: Record<string, unknown> },
   ParamName extends string | "orderBy" = "orderBy",
>(table: SqlTable<T>, paramName: ParamName | "orderBy" = "orderBy" as ParamName): SqlOrderBy<T, ParamName> {
   return new SqlOrderBy(table, { paramName: paramName as ParamName });
}
