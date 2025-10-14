import { Sql } from "../sql-base.js";
import { SqlQueryContext } from "./sql-query-context.js";

export class SqlRaw extends Sql {
   constructor(public readonly value: string) {
      super();
   }

   override build({ strings }: SqlQueryContext) {
      strings.push(this.value);
   }
}

export function raw(value: string): Sql {
   return new SqlRaw(value);
}
