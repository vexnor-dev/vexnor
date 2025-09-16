import { Sql } from "../sql-base.js";
import { SqlQueryContext } from "../sql-query-context.js";

type SqlInfoOptions = {
   label: string;
} & Record<string, unknown>;

export class SqlInfo extends Sql {
   constructor(public options: SqlInfoOptions) {
      super();
   }

   build({ strings }: SqlQueryContext) {
      strings.push("/*");
      for (const [key, value] of Object.entries(this.options)) {
         strings.push(` --${key}: ${value} `);
      }
      strings.push("*/");
   }
}

export function info(options: SqlInfoOptions) {
   return new SqlInfo(options);
}
