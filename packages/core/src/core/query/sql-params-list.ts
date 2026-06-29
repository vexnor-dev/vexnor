import { SqlParam, SqlParamAny } from "#src/core/query/sql-param.js";
import { SqlParamValidation, SqlParamValidationAny } from "#src/core/query/params/sql-param-validation.js";

export type SqlParamsList<T extends Record<string, unknown>> = {
   [K in keyof T]: K extends string ? SqlParam<{ Name: K; Type: T[K] }> : never;
};

export function params<T extends Record<string, unknown>>(
   validation?: Partial<{
      [K in keyof T]: SqlParamValidation<T[K]>;
   }>,
): SqlParamsList<T> {
   const cache = new Map<string, SqlParamAny>();
   return new Proxy(
      {},
      {
         has: () => true,
         get: (_, name) => {
            const _name = String(name);
            if (!cache.has(_name)) {
               const _validation: SqlParamValidationAny | undefined = validation?.[_name];
               cache.set(_name, new SqlParam({ name: _name, validation: _validation }));
            }

            return cache.get(_name)!;
         },
      },
   ) as SqlParamsList<T>;
}
