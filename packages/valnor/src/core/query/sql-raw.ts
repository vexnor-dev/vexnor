import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";

export class SqlRaw extends Sql {
   constructor(
      public readonly value: string,
      public readonly options?: { quote: boolean },
   ) {
      super({ ID: `SqlRaw(${value})` });
   }

   override build(context: SqlBuildContext) {
      if (this.options?.quote) {
         context.addQuotes(this.value);
      } else {
         context.addStrings(this.value);
      }
   }
}

/**
 * Creates a raw SQL string.
 * @param value The raw SQL string.
 * @param options
 * @returns The raw SQL string.
 */
export function raw(value: string, options: { quote: boolean } = { quote: true }): Sql {
   return new SqlRaw(value, options);
}
