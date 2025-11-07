import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";

export class SqlRaw extends Sql {
   constructor(
      public readonly value: string,
      public readonly quote = false,
   ) {
      super();
   }

   override build(context: SqlBuildContext) {
      if (this.quote) {
         context.addQuotes(this.value);
      } else {
         context.addStrings(this.value);
      }
   }
}

export function raw(value: string): Sql {
   return new SqlRaw(value);
}
