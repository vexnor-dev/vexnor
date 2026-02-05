import { SqlBuildContext } from "./sql-build-context.js";
import { Sql } from "../sql-base.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlParamAny = SqlParam<any>;

export class SqlParam<T extends { Name: string; Type: unknown }> extends Sql {
   name: T["Name"];

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

export function param<Name extends string>(name: Name): SqlParam<{ Name: Name; Type: unknown }> {
   return new SqlParam({ name });
}
