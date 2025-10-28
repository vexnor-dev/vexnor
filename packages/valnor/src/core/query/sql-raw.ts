import { Sql } from "../sql-base.js";
import { SqlQueryContext } from "./sql-query-context.js";

export class SqlRaw extends Sql {
   constructor(
      public readonly value: string,
      public readonly quote = false,
   ) {
      super();
   }

   override $build({ strings }: SqlQueryContext) {
      if (this.quote) {
         strings.push(`"${this.value}"`);
      } else {
         strings.push(this.value);
      }
   }
}

export function raw(value: string): Sql {
   return new SqlRaw(value);
}

export function quote(value: string): Sql {
   return new SqlRaw(value, true);
}
