import { Sql } from "../sql-base.js";
import { SqlQueryAny, SqlQueryContext } from "../query/index.js";
import { SqlBuildOptions } from "../sql-types.js";
import { SqlSelectColumn } from "./sql-select-column.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlSelectAllAny = SqlSelectAll<any>;

export class SqlSelectAll<T extends { Row: Record<string, unknown> }> extends Sql {
   constructor(
      public readonly row: InferSelectAllColumnsByRow<T["Row"]>,
      public readonly query?: SqlQueryAny,
   ) {
      super();
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   build(context: SqlQueryContext, _options?: SqlBuildOptions) {
      const [keyword, exists] = context.keywords();

      switch (true) {
         case keyword === "fn":
            context.addStrings("*");
            break;
         case keyword === "select" && exists === "exists":
            context.addStrings("*");
            break;
         default: {
            // TODO: context.queryName points to the root query instead of sub-query, since this is a SqlSelectAll not a SqlQuery
            // TODO: how to fix? .. no idea
            context.addQuotes(`${context.queryName}.*`);

            // let index = 0;
            // for (const column of Object.values(this.row)) {
            //    if (index++ > 0) context.addStrings(", ");
            //    column.build(context, options);
            // }
         }
      }
   }
}

export type InferSelectAllColumnsByRow<Row> =
   Row extends Record<string, unknown>
      ? {
           [K in keyof Row]: K extends string
              ? SqlSelectColumn<{
                   Key: K;
                   Type: Row[K];
                }>
              : never;
        }
      : never;
