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

// export type BuildSqlParams<Params> =
//    Params extends Record<string, unknown>
//       ? {
//            [K in keyof Params]: Params[K] extends Record<string, unknown>
//               ? BuildSqlParams<Params[K]>
//               : SqlParam<{ Name: Extract<K, string>; Type: Params[K] }>;
//         }
//       : unknown;
