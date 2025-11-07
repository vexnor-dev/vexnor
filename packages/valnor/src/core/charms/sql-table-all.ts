import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "../query/index.js";
import { SqlBuildOptions } from "../sql-types.js";
import { SqlTableColumn } from "../schema/index.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlTableAllAny = SqlTableAll<any>;

export class SqlTableAll<T extends { Row: Record<string, unknown> }> extends Sql {
   readonly row: InferSqlTableAllColumnsByRow<T["Row"]>;

   constructor(row: InferSqlTableAllColumnsByRow<T["Row"]>) {
      super();
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

export type InferSqlTableAllColumnsByRow<Row> =
   Row extends Record<string, unknown>
      ? {
           [K in keyof Row as `$${string & K}`]: K extends string
              ? SqlTableColumn<{
                   Key: K;
                   Type: Row[K];
                }>
              : never;
        }
      : never;
