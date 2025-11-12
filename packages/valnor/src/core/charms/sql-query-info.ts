import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "../query/index.js";

type SqlInfoOptions = {
   label: string;
} & Record<string, unknown>;

export class SqlQueryInfo extends Sql {
   constructor(public readonly options: SqlInfoOptions) {
      super({
         ID: options.label,
      });
   }

   get label() {
      return this.options.label;
   }

   build(context: SqlBuildContext) {
      context.addStrings("\n/*");
      for (const [key, value] of Object.entries(this.options)) {
         context.addStrings(` --${key}: ${value} `);
      }
      context.addStrings("*/\n");
   }
}

export function info(options: SqlInfoOptions) {
   return new SqlQueryInfo(options);
}
