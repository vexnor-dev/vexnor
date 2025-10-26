import { Sql } from "../sql-base.js";
import { SqlQueryContext } from "./sql-query-context.js";

export class SqlDefault extends Sql {
   constructor() {
      super();
   }

   $build(context: SqlQueryContext) {
      context.strings.push("DEFAULT");
   }
}

export const DEFAULT = new SqlDefault();
