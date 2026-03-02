import { SqlParam, SqlParamAny } from "./sql-param.js";

export type SqlParameters<T> = {
   [K in keyof T as K extends string ? K : never]: SqlParam<{ Name: Extract<K, string>; Type: T[K] }>;
};

export function newSqlParameters<T extends Record<string, unknown>>(): SqlParameters<T> {
   const cache = new Map<string, SqlParamAny>();

   return new Proxy(
      {},
      {
         has(target, prop) {
            return typeof prop === "string";
         },
         get(target, prop) {
            if (typeof prop !== "string") return undefined;
            if (cache.has(prop)) return cache.get(prop);

            cache.set(prop, new SqlParam({ name: prop }));
            return cache.get(prop)!;
         },
      },
   ) as SqlParameters<T>;
}
