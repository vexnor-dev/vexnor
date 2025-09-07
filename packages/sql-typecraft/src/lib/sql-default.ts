import { Sql } from "./sql-base.js";
import { SqlBuild } from "./sql-types.js";

export class SqlDefault extends Sql {
   constructor() {
      super();
   }

   build(): SqlBuild {
      return {
         strings: ["DEFAULT"],
      };
   }
}

export const DEFAULT = new SqlDefault();
