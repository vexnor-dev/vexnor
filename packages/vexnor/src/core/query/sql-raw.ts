import { Sql } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";

export class SqlRaw extends Sql {
   constructor(
      public readonly value: string,
      public readonly options?: { quote: boolean },
   ) {
      super({ type: "SqlRaw", id: value, hashId: value || "-" });
   }

   override write(context: SqlBuildContext) {
      if (!this.value) return;

      if (this.options?.quote) {
         context.addQuotes(this.value);
      } else {
         context.addStrings(this.value);
      }
   }
}

/**
 * Injects an unquoted raw SQL string directly into the query.
 *
 * Use sparingly — the value is emitted as-is with no escaping. Prefer
 * parameterized values or column references wherever possible.
 *
 * @param value - The raw SQL fragment to emit.
 */
export function raw(value: string): Sql {
   return new SqlRaw(value, { quote: false });
}

/**
 * Injects a quoted identifier (e.g. a column or table name) into the query.
 *
 * The value is wrapped in database-appropriate quotes. Use this when you need
 * to reference an identifier dynamically rather than through a generated column
 * or table object.
 *
 * @param value - The identifier to quote and emit.
 */
export function quote(value: string): Sql {
   return new SqlRaw(value, { quote: true });
}

/** Empty SQL fragment — emits nothing. Useful as a no-op placeholder. */
raw.BLANK = new SqlRaw("", { quote: false });

/** A single space SQL fragment. */
raw.SPACE = new SqlRaw(" ", { quote: false });
