import { SqlQueryContext } from "./sql-query-context.js";
import { Sql } from "../sql-base.js";

// eslint-disable-next-line unused-imports/no-unused-vars
export class SqlAs<Name extends string, Type> extends Sql {
   constructor(public readonly key: Name) {
      super();
   }

   $build(context: SqlQueryContext): void {
      context.strings.push(` as "${this.key}"`);
   }
}

export const as = {
   string: <Name extends string>(key: Name) => new SqlAs<Name, string>(key),
   number: <Name extends string>(key: Name) => new SqlAs<Name, number>(key),
   bool: <Name extends string>(key: Name) => new SqlAs<Name, boolean>(key),
   date: <Name extends string>(key: Name) => new SqlAs<Name, Date>(key),
   bigint: <Name extends string>(key: Name) => new SqlAs<Name, bigint>(key),
};
