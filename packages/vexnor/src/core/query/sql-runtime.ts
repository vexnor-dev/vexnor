import { ParamValidation } from "#/core/query/sql-param-validation.js";
import { SqlParam } from "#/core/query/sql-param.js";

/**
 * Declares a named runtime parameter with a compile-time type.
 *
 * Runtime parameters are identical to `param()` at the SQL level — they emit
 * a placeholder at build time. The distinction is semantic and enforced by the
 * `QueryRegistry`: values for runtime parameters are injected from the trusted
 * server-side runtime context rather than from the caller-supplied params.
 *
 * On direct execution (outside the registry), runtime values are passed just
 * like regular params.
 *
 * @param key - The parameter name must be a key of `T`.
 * @param validation - Optional validation rules applied before execution.
 * @returns A `SqlParam` node with `isRuntime: true` that emits a placeholder at build time.
 *
 * @example
 * const q = sql`
 *   SELECT ${row(Order.$$)}
 *   FROM ${Order}
 *   WHERE ${Order.$userId} = ${runtime<{ userId: string }>("userId")}
 * `;
 * // Direct execution: q.postgres.all({ db, params: { userId: "123" } })
 * // Registry execution: userId injected automatically from registry context
 */
export function runtime<
   T extends Record<string, unknown>,
   K extends Extract<keyof T, string> = Extract<keyof T, string>,
>(key: K, validation?: ParamValidation<T[K]>): SqlParam<{ Name: K; Type: T[K] }> {
   return new SqlParam<{ Name: K; Type: T[K] }>({
      name: key,
      validation: validation as ParamValidation<T[K]> | undefined,
      isRuntime: true,
   });
}
