import type { QueryMeta } from "#/core/query/sql-query-types.js";

const store = new WeakMap<object, QueryMeta>();

/**
 * Stores query execution metadata keyed by the result object.
 * Called internally by SqlQueryHandler and HttpRemoteClient after every execution.
 */
export function setQueryMeta(result: unknown, meta: QueryMeta): void {
   if (result && typeof result === "object") store.set(result as object, meta);
}

/**
 * Retrieves query execution metadata for a given result object.
 * Returns undefined if the result was not produced by a vexnor query execution.
 */
export function getQueryMeta(result: unknown): QueryMeta | undefined {
   if (result && typeof result === "object") return store.get(result as object);
   return undefined;
}
