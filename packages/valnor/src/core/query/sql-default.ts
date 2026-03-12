import { Sql } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";

export class SqlDefault extends Sql {
   constructor() {
      super({ id: "DEFAULT" });
   }

   write(context: SqlBuildContext) {
      context.addStrings("DEFAULT");
   }
}

export const DEFAULT = new SqlDefault();
