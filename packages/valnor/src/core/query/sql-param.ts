import { SqlBuildContext } from "./sql-build-context.js";
import { Sql } from "../sql-base.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlParamAny = SqlParam<any>;

export class SqlParam<T extends { Name: string; Type: unknown }> extends Sql {
   static PREFIX = "$";
   name: T["Name"];

   constructor({ name }: { name: T["Name"] }) {
      super();
      if (name.startsWith(SqlParam.PREFIX)) throw new TypeError(`Param name must not start with ${SqlParam.PREFIX}`);
      this.name = name;
   }

   get wildcard(): string {
      return `${SqlParam.PREFIX}${this.name}`;
   }

   build(context: SqlBuildContext): void {
      context.addValues(this);
      context.addStrings(this.wildcard);
   }

   is<Type>() {
      return this as SqlParam<{ Name: T["Name"]; Type: Type }>;
   }
}

export function param<Name extends string>(name: Name): SqlParam<{ Name: Name; Type: unknown }> {
   return new SqlParam({ name });
}

export const it = Object.create(null);
