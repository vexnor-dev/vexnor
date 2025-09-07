import { SqlBuild } from "./sql-types.js";
import { Sql } from "./sql-base.js";

export class SqlRaw extends Sql {
   constructor(public readonly value: string) {
      super();
   }

   build(): SqlBuild {
      return {
         strings: [this.value],
      };
   }
}

export function raw(value: string) {
   return new SqlRaw(value);
}
