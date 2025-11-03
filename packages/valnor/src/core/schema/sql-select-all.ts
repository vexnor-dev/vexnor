import { Sql } from "../sql-base.js";
import { SqlQueryContext } from "../query/index.js";
import { SqlBuildOptions, SqlQueryRowOut } from "../sql-types.js";
import { SqlColumn } from "./sql-column.js";

export class SqlSelectAll<Select extends SqlQueryRowOut> extends Sql {
   constructor(readonly columns: InferSqlAllFromSelect<Select>) {
      super();
   }

   $build(context: SqlQueryContext, options?: SqlBuildOptions) {
      const [keyword, exists] = context.keywords();

      switch (true) {
         case keyword === "fn":
            context.strings.push("*");
            break;
         case keyword === "select" && exists === "exists":
            context.strings.push("*");
            break;
         default: {
            let i = 0;
            for (const column of this.columns) {
               if (i++ > 0) context.strings.push(", ");

               column.$build(context, options);
            }
         }
      }
   }
}

export type InferSqlAllFromSelect<Select extends Record<string, unknown>> = {
   [K in keyof Select]: K extends string ? SqlColumn<{ Key: K; Type: Select[K] }> : never;
}[keyof Select][];
