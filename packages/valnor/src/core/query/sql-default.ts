import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";

export class SqlDefault extends Sql {
   readonly ID: string;
   constructor() {
      super();
      this.ID = "DEFAULT";
   }

   build(context: SqlBuildContext) {
      context.addStrings("DEFAULT");
   }
}

export const DEFAULT = new SqlDefault();
