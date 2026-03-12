import { InferTable$RowBySelect } from "#/core/types/infer-types.js";
import { Sql, TYPE } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#/core/builder/sql-build-options.js";

export type SqlTableAllAny = SqlTableAll<any>;

export class SqlTableAll<Row extends Record<string, unknown>> extends Sql {
   declare readonly [TYPE]: Row;

   readonly row: InferTable$RowBySelect<Row>;

   constructor(row: InferTable$RowBySelect<Row>) {
      super({ id: `${Object.keys(row).join(", ")}` });
      this.row = row;
   }

   write(context: SqlBuildContext, options?: SqlBuildOptions) {
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
