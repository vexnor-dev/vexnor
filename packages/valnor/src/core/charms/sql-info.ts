import { Sql } from "../sql-base.js";
import { SqlQueryContext } from "../query/index.js";

type SqlInfoOptions = {
   label: string;
} & Record<string, unknown>;

export class SqlInfo extends Sql {
   constructor(public options: SqlInfoOptions) {
      super();
   }

   $build({ strings }: SqlQueryContext) {
      strings.push("\n/*");
      for (const [key, value] of Object.entries(this.options)) {
         strings.push(` --${key}: ${value} `);
      }
      strings.push("*/\n");
   }
}

export function info(options: SqlInfoOptions) {
   return new SqlInfo(options);
}
