import { Sql } from "../sql-base.js";
import { SqlQueryContext } from "./sql-query-context.js";

export class SqlParam<TName extends string> extends Sql {
   name: TName;
   static PREFIX = "$";

   constructor(name: TName) {
      super();
      if (name.startsWith(SqlParam.PREFIX)) throw new TypeError(`Param name must not start with ${SqlParam.PREFIX}`);
      this.name = name;
   }

   get wildcard(): string {
      return `${SqlParam.PREFIX}${this.name}`;
   }

   build({ strings, values }: SqlQueryContext): void {
      values.push(this);
      strings.push(this.wildcard);
   }
}

export function param<T extends string>(name: T): SqlParam<T> {
   return new SqlParam<T>(name);
}
