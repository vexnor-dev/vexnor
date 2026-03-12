import { Sql } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";

// eslint-disable-next-line unused-imports/no-unused-vars
export class SqlType<T = unknown> extends Sql {
   constructor() {
      super({ id: "" });
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   write(_context: SqlBuildContext): void {
      // No-op: type markers don't produce SQL
   }
}

export function t<T>(): SqlType<T> {
   return new SqlType<T>();
}
