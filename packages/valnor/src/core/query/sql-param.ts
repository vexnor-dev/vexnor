import { SqlBuildContext } from "./sql-build-context.js";
import { PARAMS, Sql } from "../sql-base.js";
import { ValueTypeAny, ValueTypeOf } from "./sql-models.js";
import { SqlBuildError } from "../sql-build-error.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlParamAny = SqlParam<any>;

export class SqlParam<T extends { Name: string; Type: unknown }> extends Sql {
   declare readonly [PARAMS]: Record<T["Name"], T["Type"]>;

   readonly name: T["Name"];

   constructor({ name }: { name: T["Name"] }) {
      super({
         ID: name,
      });
      this.name = name;
   }

   build(context: SqlBuildContext): void {
      context.addParam(this);
   }

   is<Type>() {
      return this as SqlParam<{ Name: T["Name"]; Type: Type }>;
   }
}

export type ParamResult<T extends string | Record<string, ValueTypeAny>> = T extends string
   ? SqlParam<{ Name: T; Type: unknown }>
   : T extends object
     ? SqlParam<{ Name: Extract<keyof T, string>; Type: ValueTypeOf<T[keyof T]> }>
     : never;

export function param<T extends string | Record<string, ValueTypeAny>>(args: T): ParamResult<T> {
   switch (typeof args) {
      case "string":
         return new SqlParam({ name: args }) as ParamResult<T>;
      case "object": {
         const [key] = Object.keys(args);
         if (!key) throw new SqlBuildError("Object must contain at least one key");

         return new SqlParam({ name: key }) as ParamResult<T>;
      }
   }
}

export type BuildSqlParams<Params> =
   Params extends Record<string, unknown>
      ? {
           [K in keyof Params]: K extends string ? SqlParam<{ Name: K; Type: Params[K] }> : never;
        }
      : unknown;

export type SqlQueryParams<T> = T extends { Params: Record<infer Key extends string, infer Type> }
   ? Record<Key, SqlParam<{ Name: Key; Type: Type }>>
   : null;
