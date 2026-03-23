import { SqlBuildContext } from "#/core/core.js";
import { ARGS, PARAMS, Sql } from "#/core/sql-base.js";
import { SqlBuildOptions } from "#/core/core.js";
import { SqlParam } from "#/core/query/sql-param.js";
import { Cache } from "#/lib/cache.js";

export class SqlInput<T extends { Params: Record<string, unknown> }> extends Sql {
   declare readonly [PARAMS]: T["Params"];
   declare readonly [ARGS]?: T["Params"];

   // eslint-disable-next-line unused-imports/no-unused-vars
   write(_context: SqlBuildContext, _options?: SqlBuildOptions) {}
}

export type SqlInputParams<T extends { Params: Record<string, unknown> }> = {
   [K in keyof T["Params"] as K extends string ? `$${K}` : never]: SqlParam<{
      Name: Extract<K, string>;
      Type: T["Params"][K];
   }>;
};

export type SqlInputExtended<T> = T extends { Params: Record<string, unknown> }
   ? SqlInput<T> & SqlInputParams<T>
   : SqlInput<{ Params: {} }>;

/**
 * Creates a typed parameter proxy for use in reusable parameterized queries.
 *
 * Returns an object where every property access `.$key` yields a `SqlParam` for
 * that key, typed against `Params`. This is an alternative to calling `param()`
 * individually for each parameter — useful when building a query with many
 * parameters or when the param set is defined separately as a type.
 *
 * @returns A proxy object where `.$key` returns a `SqlParam` for that key.
 *
 * @example
 * type Params = { firstName: string; email: string };
 * const p = input<Params>();
 *
 * const q = sql`
 *   SELECT ${row(Account.$$)}
 *   FROM ${Account}
 *   WHERE ${Account.$firstName} = ${p.$firstName}
 *     AND ${Account.$email}     = ${p.$email}
 * `;
 * // q requires: { firstName: string; email: string }
 */
export function input<Params extends Record<string, unknown> | void>(): SqlInputExtended<{ Params: Params }> {
   const cache = new Cache();

   return new Proxy(
      {},
      {
         has(_target, prop) {
            return typeof prop === "string";
         },

         get(_target, prop) {
            if (typeof prop !== "string") return undefined;
            return cache.get([prop], () => new SqlParam({ name: prop.startsWith("$") ? prop.substring(1) : prop }));
         },
      },
   ) as SqlInputExtended<{ Params: Params }>;
}
