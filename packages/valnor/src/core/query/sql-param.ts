import { ARGS, PARAMS, Sql } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { Primitive } from "#/lib/primitive.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlParamAny = SqlParam<any>;

export class SqlParam<T extends { Name: string; Type: unknown }> extends Sql {
   declare readonly [PARAMS]: Record<T["Name"], T["Type"]>;
   declare readonly [ARGS]?: T["Type"];

   readonly name: T["Name"];

   constructor({ name }: { name: T["Name"] }) {
      super({
         id: name,
      });

      this.name = name;
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
export function param<T extends Record<string, Primitive | Primitive[]> | undefined = undefined>(
   key: Extract<keyof T, string>,
): SqlParam<{ Name: Extract<keyof T, string>; Type: T[keyof T] }> {
   return new SqlParam<{ Name: Extract<keyof T, string>; Type: T[typeof key] }>({ name: key });
}

export type BuildSqlParams<Params> =
   Params extends Record<string, unknown>
      ? {
           [K in keyof Params]: K extends string ? SqlParam<{ Name: K; Type: Params[K] }> : never;
        }
      : unknown;
