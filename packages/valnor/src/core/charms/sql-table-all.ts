import { Sql } from "../sql-base.js";
import { SqlBuildContext, SqlBuildOptions } from "../query/index.js";
import { InferTable$RowBySelect } from "../types/index.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlTableAllAny = SqlTableAll<any>;

export class SqlTableAll<T extends { Row: Record<string, unknown> }> extends Sql {
   readonly row: InferTable$RowBySelect<T["Row"]>;

   constructor(row: InferTable$RowBySelect<T["Row"]>) {
      super({ ID: `${Object.keys(row).join(", ")}` });
      this.row = row;
   }

   build(context: SqlBuildContext, options?: SqlBuildOptions) {
      const [keyword, exists] = context.keywords();

      switch (true) {
         case keyword === "fn":
            context.addStrings("*");
            break;
         case keyword === "select" && exists === "exists":
            context.addStrings("*");
            break;
         default: {
            let index = 0;
            for (const column of Object.values(this.row)) {
               if (index++ > 0) context.addStrings(", ");
               column.build(context, options);
            }
         }
      }
   }
}
