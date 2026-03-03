import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";

export class SqlRaw extends Sql {
   constructor(
      public readonly value: string,
      public readonly options?: { quote: boolean },
   ) {
      super({ id: `SqlRaw(${value})` });
   }

   override build(context: SqlBuildContext) {
      if (!this.value) return;

      if (this.options?.quote) {
         context.addQuotes(this.value);
      } else {
         context.addStrings(this.value);
      }
   }
}

/**
 * Creates an unquoted raw SQL string.
 * @param value The raw SQL string.
 * @returns The raw SQL string.
 */
export function raw(value: string): Sql {
   return new SqlRaw(value, { quote: false });
}

/**
 * Creates a quoted raw SQL string.
 * @param value The raw SQL string.
 * @returns The raw SQL string.
 */
export function quote(value: string): Sql {
   return new SqlRaw(value, { quote: true });
}

/**
 * SQL raw blank string
 */
raw.BLANK = new SqlRaw("", { quote: false });
