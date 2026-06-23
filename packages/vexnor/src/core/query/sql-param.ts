import { ARGS, PARAMS, ParamsOfArgs, Sql, SqlOptions } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { isParamValueValid, SqlParamValidation } from "#/core/query/params/sql-param-validation.js";
import { SqlBuildError } from "#/core/sql-build-error.js";
import { SqlErrorCode } from "#/core/sql-error-code.js";
import { resolvePath } from "#/core/query/resolve-path.js";
import { validateParamValue } from "#/core/query/params/validate-param-value.js";

export type SqlParamTypeArgs = { Name: string; Type: unknown };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlParamAny = SqlParam<any>;

/**
 * Converts a dot-path string into a nested object type.
 * "orderBy.email" → { orderBy: { email: T } }
 * "email" → { email: T }
 */
export type PathToNested<Path extends string, T> = Path extends `${infer Head}.${infer Tail}`
   ? { [K in Head]: PathToNested<Tail, T> }
   : undefined extends T
     ? { [K in Path]?: Exclude<T, undefined> }
     : { [K in Path]: T };

/**
 * Extracts all leaf paths from a nested object type.
 * { address: { city: string; zip: number }; name: string } → "address.city" | "address.zip" | "name"
 */
export type LeafPaths<T, Prefix extends string = ""> = T extends Record<string, unknown>
   ? { [K in keyof T & string]: T[K] extends Record<string, unknown>
        ? LeafPaths<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`
     }[keyof T & string]
   : never;

/**
 * Resolves the type at a dot-path within a nested object.
 * PathType<{ address: { city: string } }, "address.city"> → string
 */
export type PathType<T, Path extends string> = Path extends `${infer Head}.${infer Tail}`
   ? Head extends keyof T ? PathType<T[Head], Tail> : never
   : Path extends keyof T ? T[Path] : never;

export class SqlParam<T extends SqlParamTypeArgs> extends Sql {
   declare readonly [PARAMS]: PathToNested<T["Name"], T["Type"]>;
   declare readonly [ARGS]?: T["Type"];

   readonly name: T["Name"];
   readonly isContext: boolean;
   readonly validation: SqlParamValidation<T["Type"]> | null;
   readonly default: unknown | null;
   readonly hasDefault: boolean;

   constructor({
      name,
      validation,
      isContext,
   }: {
      name: T["Name"];
      validation?: SqlParamValidation<T["Type"]> | null;
      isContext?: boolean;
   }) {
      super(
         (() => {
            const type = isContext ? "SqlContext" : "SqlParam";
            return {
               type,
               id: name,
               hashId: name,
            } satisfies SqlOptions;
         })(),
      );

      this.name = name;
      this.isContext = isContext ?? false;
      this.validation = validation ?? null;
      this.hasDefault = validation != null && "default" in validation;
      this.default = this.hasDefault ? (validation!.default ?? null) : null;
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
    * Resolves this param's value from a params object using dot-path traversal.
    * "orderBy.field" → params.orderBy.field
    * "email" → params.email
    */
   resolve(params: Record<string, unknown>): unknown {
      return this.valueOrDefault(resolvePath(params, this.name));
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
 * Supports dot-path names for nested params: `param<P>("orderBy.field")` → `{ orderBy: { field: T } }`
 * Only leaf paths are allowed — intermediate objects are rejected at compile time.
 *
 * @param key - The parameter name (dot-separated path to a leaf value).
 * @param validation - The optional parameter validation
 */
export function param<T extends Record<string, unknown>, K extends LeafPaths<T> = LeafPaths<T>>(
   key: K,
   validation?: SqlParamValidation<PathType<T, K>> | null,
): SqlParam<{ Name: K; Type: PathType<T, K> }> {
   return new SqlParam<{ Name: K; Type: PathType<T, K> }>({
      name: key,
      validation: validation as SqlParamValidation<PathType<T, K>> | undefined,
      isContext: false,
   });
}

/**
 * Declares a named runtime parameter with a compile-time type.
 *
 * Context parameters are injected server-side from registry context.
 * Supports dot-path names for nested params. Only leaf paths are allowed.
 *
 * @param key - The parameter name (dot-separated path to a leaf value).
 * @param validation - Optional validation rules applied before execution.
 */
export function ctx<T extends Record<string, unknown>, K extends LeafPaths<T> = LeafPaths<T>>(
   key: K,
   validation?: SqlParamValidation<PathType<T, K>> | null,
): SqlParam<{ Name: K; Type: PathType<T, K> }> {
   return new SqlParam<{ Name: K; Type: PathType<T, K> }>({
      name: key,
      validation: validation as SqlParamValidation<PathType<T, K>> | undefined,
      isContext: true,
   });
}

export type BuildSqlParams<Params> =
   Params extends Record<string, unknown>
      ? {
           [K in keyof Params]: K extends string
              ? Params[K] extends Record<string, unknown>
                ? BuildSqlParams<Params[K]>
                : SqlParam<{ Name: K; Type: Params[K] }>
              : never;
        }
      : unknown;

export type InferSqlParams<Params> =
   Params extends Record<string, SqlParamAny>
      ? ParamsOfArgs<{
           [K in keyof Params]: Params[K] extends SqlParamAny ? Params[K] : never;
        }>
      : unknown;