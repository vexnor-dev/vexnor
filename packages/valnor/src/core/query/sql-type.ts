import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";

export class SqlType<T = unknown> extends Sql {
   constructor() {
      super({ ID: "" });
   }

   build(_context: SqlBuildContext): void {
      // No-op: type markers don't produce SQL
   }
}

export function t<T>(): SqlType<T> {
   return new SqlType<T>();
}
