import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";

export class SqlRaw extends Sql {
   readonly ID: string;

   constructor(
      public readonly value: string,
      public readonly quote = false,
   ) {
      super();
      this.ID = value;
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
