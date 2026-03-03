import { SqlParam, SqlParamAny } from "./sql-param.js";
import { ARGS, PARAMS, Sql } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { SqlBuildOptions } from "./sql-query-types.js";
import { cache } from "../../lib/index.js";

export class SqlInput<T extends { Params: Record<string, unknown> }> extends Sql {
   declare readonly [PARAMS]: T["Params"];
   declare readonly [ARGS]?: T["Params"];

   // eslint-disable-next-line unused-imports/no-unused-vars
   build(_context: SqlBuildContext, _options?: SqlBuildOptions) {}
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

export function input<Params extends Record<string, unknown> | void>(): SqlInputExtended<{ Params: Params }> {
   const map = new Map<string, SqlParamAny>();

   return new Proxy(
      {},
      {
         has(target, prop) {
            return typeof prop === "string";
         },
         get(target, prop) {
            if (typeof prop !== "string") return undefined;
            return cache(map).get(prop, () => new SqlParam({ name: prop.startsWith("$") ? prop.substring(1) : prop }));
         },
      },
   ) as SqlInputExtended<{ Params: Params }>;
}
