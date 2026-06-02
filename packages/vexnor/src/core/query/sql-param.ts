import { ARGS, PARAMS, ParamsOfArgs, Sql } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { isParamValueValid, ParamValidation, validateParamValue } from "#/core/query/sql-param-validation.js";
import { SqlBuildError } from "#/core/sql-build-error.js";
import { SqlErrorCode } from "#/core/sql-error-code.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlParamAny = SqlParam<any>;

export type SqlParamShape<Name extends string, Type> = undefined extends Type
   ? { [K in Name]?: Exclude<Type, undefined> }
   : { [K in Name]: Type };

export class SqlParam<T extends { Name: string; Type: unknown }> extends Sql {
   declare readonly [PARAMS]: SqlParamShape<T["Name"], T["Type"]>;
   declare readonly [ARGS]?: T["Type"];

   readonly name: T["Name"];
   readonly validation: ParamValidation<T["Type"]> | null;
   readonly default: unknown | null;
   readonly hasDefault: boolean;

   constructor({ name, validation }: { name: T["Name"]; validation?: ParamValidation<T["Type"]> | null }) {
      super({
         type: "SqlParam",
         id: name,
      });

      this.name = name;
      this.validation = validation ?? null;
      this.hasDefault = validation != null && "default" in validation;
      this.default = this.hasDefault ? validation!.default ?? null : null;
   }

   write(context: SqlBuildContext): void {
      context.addParam(this);
   }

   validate(value: unknown) {
      const errors = validateParamValue(value, this.validation);
      if (errors.length)
         throw new SqlBuildError(`Invalid param '${this.name}': ${errors.join("; ")}`, {
            code: SqlErrorCode.PARAM_VALIDATION_FAILED,
         });
   }

   /**
    * Resolves the final value for query execution:
    * - `undefined` → declared default (or null)
    * - present + valid → value as-is
    * - present + invalid + default declared → declared default (silent fallback)
    * - present + invalid + no default → throws
    */
   valueOrDefault(value: unknown): unknown {
      if (value === undefined) return this.hasDefault ? this.default : undefined;

      const errors = validateParamValue(value, this.validation);
      if (!errors.length) return value;

      if (this.hasDefault) return this.default;

      throw new SqlBuildError(`Invalid param '${this.name}': ${errors.join("; ")}`, {
         code: SqlErrorCode.PARAM_VALIDATION_FAILED,
      });
   }

   isValid(value: unknown): boolean {
      return isParamValueValid(value, this.validation);
   }

   validOrDefault<D>(value: unknown, defaultValue: D): T["Type"] | D {
      return this.isValid(value) ? (value as T["Type"]) : defaultValue;
   }
}

/**
 * Declares a named query parameter with a compile-time type.
 *
 * The type argument `T` is the full params record for the query. The `key`
 * argument picks one property from it. TypeScript will enforce that the correct
 * `params` object is passed when the query is executed.
 *
 * @param key - The parameter name, must be a key of `T`.
 * @param validation - The optional parameter validation
 * @returns A `SqlParam` node that emits a placeholder (`?` / `$1` etc.) at build time.
 *
 * @example
 * // Single param
 * const q = sql`
 *   SELECT ${row(Account.$$)}
 *   FROM ${Account}
 *   WHERE ${Account.$accountId} = ${param<{ id: string }>("id")}
 * `;
 * // q requires: { id: string }
 *
 * @example
 * // Multiple params — share the same type argument across all param() calls
 * type Params = { firstName: string; email: string };
 *
 * const q = sql`
 *   SELECT ${row(Account.$$)}
 *   FROM ${Account}
 *   WHERE ${Account.$firstName} = ${param<Params>("firstName")}
 *     AND ${Account.$email}     = ${param<Params>("email")}
 * `;
 * // q requires: { firstName: string; email: string }
 */
export function param<T extends Record<string, unknown>, K extends Extract<keyof T, string> = Extract<keyof T, string>>(
   key: K,
   validation?: ParamValidation<T[K]>,
): SqlParam<{ Name: K; Type: T[K] }> {
   return new SqlParam<{ Name: K; Type: T[K] }>({
      name: key,
      validation: validation as ParamValidation<T[K]> | undefined,
   });
}

export type BuildSqlParams<Params> =
   Params extends Record<string, unknown>
      ? {
           [K in keyof Params]: K extends string ? SqlParam<{ Name: K; Type: Params[K] }> : never;
        }
      : unknown;

export type InferSqlParams<Params> =
   Params extends Record<string, SqlParamAny>
      ? ParamsOfArgs<{
           [K in keyof Params]: Params[K] extends SqlParamAny ? Params[K] : never;
        }>
      : unknown;
