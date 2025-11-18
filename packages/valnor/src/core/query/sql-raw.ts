import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";

export class SqlRaw extends Sql {
   constructor(
      public readonly value: string,
      public readonly quote = false,
   ) {
      super({ ID: `SqlRaw(${value})` });
   }

   override build(context: SqlBuildContext) {
      if (this.quote) {
         context.addQuotes(this.value);
      } else {
         context.addStrings(this.value);
      }
   }
}

/**
 * Creates a raw SQL string.
 * @param value The raw SQL string.
 * @param quote If true, the raw SQL string will be quoted.
 * @returns The raw SQL string.
 */
export function raw(value: string, quote = true): Sql {
   return new SqlRaw(value, quote);
}
