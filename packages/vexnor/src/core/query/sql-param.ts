import { ARGS, PARAMS, Sql } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { Primitive } from "#/lib/primitive.js";
import { ParamValidation } from "#/core/query/sql-param-validation.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlParamAny = SqlParam<any>;
export type SqlParamShape<Name extends string, Type> = undefined extends Type
   ? { [K in Name]?: Exclude<Type, undefined> }
   : { [K in Name]: Type };

export class SqlParam<T extends { Name: string; Type: unknown }> extends Sql {
   declare readonly [PARAMS]: SqlParamShape<T["Name"], T["Type"]>;
   declare readonly [ARGS]?: T["Type"];

   readonly name: T["Name"];
   readonly validation: ParamValidation<unknown> | null;

   constructor({ name, validation }: { name: T["Name"]; validation?: ParamValidation<unknown> | null }) {
      super({
         type: "SqlParam",
         id: name,
      });

      this.name = name;
      this.validation = validation ?? null;
   }

   write(context: SqlBuildContext): void {
      context.addParam(this);
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
export function param<
   T extends Record<string, Primitive | Primitive[]>,
   K extends Extract<keyof T, string> = Extract<keyof T, string>,
>(key: K, validation?: ParamValidation<T[K]>): SqlParam<{ Name: K; Type: T[K] }> {
   return new SqlParam<{ Name: K; Type: T[K] }>({
      name: key,
      validation: validation as ParamValidation<unknown> | undefined,
   });
}

export type BuildSqlParams<Params> =
   Params extends Record<string, unknown>
      ? {
           [K in keyof Params]: K extends string ? SqlParam<{ Name: K; Type: Params[K] }> : never;
        }
      : unknown;
