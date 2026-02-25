import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "../query/index.js";

export type SqlQueryInfoOptions = {
   label?: string;
   inline?: boolean;
} & Record<string, unknown>;

export class SqlQueryInfo extends Sql {
   readonly label: string | null;
   readonly inline: boolean | null;

   constructor(public readonly options: SqlQueryInfoOptions) {
      super({
         id: Object.entries(options)
            .map(([k, v]) => `${k}=${v}`)
            .join(", "),
      });
      this.label = options.label ?? null;
      this.inline = options.inline ?? null;
   }

   build(context: SqlBuildContext) {
      context.addStrings("\n/*");
      for (const [key, value] of Object.entries(this.options)) {
         context.addStrings(` --${key}: ${value} `);
      }
      context.addStrings("*/\n");
   }
}

export function info(options: SqlQueryInfoOptions) {
   return new SqlQueryInfo(options);
}
