/** Extracts a union of all value types from an object type. */
export type ValuesOf<T> = T[keyof T];

/**
 * Converts a SELECT result type for JSON transport by replacing `Date` values
 * with `string` — reflecting how dates are serialised when returned via JSON
 * aggregation functions (`jsonMany`, `jsonOne`).
 *
 * Used in generated files as `ITableNameJson`.
 */
export type JsonRow<T> =
   T extends Record<string, unknown> ? { [K in keyof T]: T[K] extends Date ? string : T[K] } : never;
