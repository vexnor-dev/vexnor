import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";

export class SqlDefault extends Sql {
   constructor() {
      super({ id: "DEFAULT" });
   }

   build(context: SqlBuildContext) {
      context.addStrings("DEFAULT");
   }
}

export const DEFAULT = new SqlDefault();
