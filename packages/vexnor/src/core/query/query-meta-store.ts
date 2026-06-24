import type { QueryMeta } from "#/core/query/sql-query-types.js";

const store = new WeakMap<object, QueryMeta>();
const META_SYM = Symbol.for("vexnor.queryMeta");

/**
 * Stores query execution metadata keyed by the result object.
 * Called internally by SqlQueryHandler and HttpRemoteClient after every execution.
 */
export function setQueryMeta(result: unknown, meta: QueryMeta): void {
   if (result && typeof result === "object") {
      store.set(result as object, meta);
      Object.defineProperty(result, META_SYM, { value: meta, configurable: true, writable: true });
   }
}

/**
 * Retrieves query execution metadata for a given result object.
 * Returns undefined if the result was not produced by a vexnor query execution.
 */
export function getQueryMeta(result: unknown): QueryMeta | undefined {
   if (result && typeof result === "object") {
      return store.get(result as object) ?? Object.getOwnPropertyDescriptor(result, META_SYM)?.value as QueryMeta | undefined;
   }
   return undefined;
}
