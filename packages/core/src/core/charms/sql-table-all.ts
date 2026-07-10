import { InferTable$RowBySelect } from "#src/core/types/infer-types.js";
import { Sql, TYPE } from "#src/core/sql-base.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#src/core/builder/sql-build-options.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlTableAllAny = SqlTableAll<any>;

export class SqlTableAll<Row extends Record<string, unknown>> extends Sql {
   declare readonly [TYPE]: Row;

   readonly row: InferTable$RowBySelect<Row>;

   constructor(row: InferTable$RowBySelect<Row>) {
      super({
         type: "SqlTableAll",
         id: `${Object.keys(row).join(", ")}`,
         hashId: Object.values(row)
            .map((c) => c.hashId)
            .join(","),
      });
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
            const viewFilter = context.viewFilter;
            let index = 0;
            for (const column of Object.values(this.row)) {
               // If view filter is active, skip columns not in the filter
               if (viewFilter?.columns && !viewFilter.columns.has(column.key)) continue;
               if (index++ > 0) context.addStrings(", ");
               column.build(context, options);
            }
         }
      }
   }
}
