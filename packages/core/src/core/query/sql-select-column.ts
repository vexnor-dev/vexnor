import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#src/core/builder/sql-build-options.js";
import { PARAMS, ROW, Sql, TYPE } from "#src/core/sql-base.js";
import { BuildSqlParams } from "#src/core/query/sql-param.js";

export type SqlWriteHandler = (context: SqlBuildContext, options?: SqlBuildOptions | null) => void;

export type SqlSelectColumnArgs<T extends { Key: string; Type: unknown; Params?: unknown }> =
   | Pick<SqlSelectColumn<T>, "key">
   | NonNullable<Pick<SqlSelectColumn<T>, "key" | "params" | "onWrite">>;

export class SqlSelectColumn<T extends { Key: string; Type: unknown; Params?: unknown }> extends Sql {
   declare readonly [ROW]: Record<T["Key"], T["Type"]>;
   declare readonly [TYPE]: Record<T["Key"], T["Type"]>;
   declare readonly [PARAMS]: T["Params"];

   readonly key: T["Key"];
   readonly params: BuildSqlParams<T["Params"]> | null;
   readonly onWrite: SqlWriteHandler | null;

   constructor({ key, ...args }: SqlSelectColumnArgs<T>) {
      super({
         type: "SqlSelectColumn",
         id: key,
         hashId: key,
      });
      this.key = key;

      if ("onWrite" in args) {
         this.onWrite = args.onWrite;
         this.params = "params" in args ? args.params : null;
      } else {
         this.onWrite = null;
         this.params = null;
      }
   }

   protected write(context: SqlBuildContext, options?: SqlBuildOptions | null): void {
      if (this.onWrite) {
         this.onWrite(context, options);
         return;
      }

      context.addStrings(`"${this.key}"`);
   }
}

/**
 * Declares a named SELECT column with an optional custom SQL write handler.
 *
 * Use the single-argument form to reference a column by key when the column
 * name is sufficient (e.g. in a CTE output or a known alias). Use the
 * three-argument form to provide a custom `onWrite` handler that emits
 * arbitrary SQL for that column position, while still registering the key
 * and type for result inference.
 *
 * @param key - The result key and TypeScript property name for this column.
 * @param onWrite - Optional custom handler that writes the SQL for this column.
 * @param params - Required when `onWrite` is provided and the expression uses params.
 *
 * @example
 * // Simple column reference by key
 * sql`SELECT ${col<{ status: string }>("status")} FROM ${Account}`
 * // result: { status: string }
 *
 * @example
 * // Custom expression with a known result type
 * sql`
 *   SELECT ${col<{ fullName: string }>("fullName", (ctx) =>
 *     ctx.addStrings(`first_name || ' ' || last_name`)
 *   )}
 *   FROM ${Account}
 * `
 * // result: { fullName: string }
 */
export function col<T extends Record<string, unknown>>(
   key: Extract<keyof T, string>,
): SqlSelectColumn<{ Key: Extract<keyof T, string>; Type: T[typeof key] }>;
export function col<T extends Record<string, unknown>, Params extends Record<string, unknown>>(
   key: Extract<keyof T, string>,
   onWrite: SqlWriteHandler,
   params: BuildSqlParams<Params>,
): SqlSelectColumn<{ Key: Extract<keyof T, string>; Type: T[typeof key]; Params: Params }>;
export function col<T extends Record<string, unknown>, Params extends Record<string, unknown>>(
   key: Extract<keyof T, string>,
   onWrite?: SqlWriteHandler,
   params?: BuildSqlParams<Params>,
): SqlSelectColumn<{ Key: Extract<keyof T, string>; Type: T[typeof key]; Params?: Params }> {
   return new SqlSelectColumn(onWrite ? { key, onWrite, params: params ?? null } : { key });
}
