import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#/core/builder/sql-build-options.js";
import { PARAMS, ROW, Sql, TYPE } from "#/core/sql-base.js";
import { BuildSqlParams } from "#/core/query/sql-param.js";

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
         id: key,
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
