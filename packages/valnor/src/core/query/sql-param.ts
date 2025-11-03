import { SqlQueryContext } from "./sql-query-context.js";
import { Sql } from "../sql-base.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlParamAny = SqlParam<any, any>;

export class SqlParam<Name extends string, Type> extends Sql {
   static PREFIX = "$";
   name: Name;

   constructor({ name }: { name: Name }) {
      super();
      if (name.startsWith(SqlParam.PREFIX)) throw new TypeError(`Param name must not start with ${SqlParam.PREFIX}`);
      this.name = name;
   }

   get wildcard(): string {
      return `${SqlParam.PREFIX}${this.name}`;
   }

   $build({ strings, values }: SqlQueryContext): void {
      values.push(this);
      strings.push(this.wildcard);
   }

   array(): SqlParam<Name, Type[]> {
      return this as SqlParam<Name, Type[]>;
   }
}

export function param<Name extends string>(name: Name): SqlParam<Name, unknown> {
   return new SqlParam<Name, unknown>({ name });
}

param.string = <Name extends string>(name: Name) => new SqlParam<Name, string>({ name });
param.number = <Name extends string>(name: Name) => new SqlParam<Name, number>({ name });
param.date = <Name extends string>(name: Name) => new SqlParam<Name, Date>({ name });
param.bool = <Name extends string>(name: Name) => new SqlParam<Name, boolean>({ name });
param.array = <Name extends string, Type>(name: Name) => new SqlParam<Name, Type[]>({ name });
param.bigInt = <Name extends string>(name: Name) => new SqlParam<Name, bigint>({ name });
