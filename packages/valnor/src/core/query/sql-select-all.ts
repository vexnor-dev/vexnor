import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "../query/index.js";
import { SqlBuildOptions } from "../sql-types.js";
import { InferSelectRowByResult } from "./sql-query-types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlSelectAllAny = SqlSelectAll<any>;

export class SqlSelectAll<T extends { Row: Record<string, unknown> }> extends Sql {
   constructor(public readonly row: InferSelectRowByResult<T["Row"]>) {
      super({
         ID: `${Object.values(row)
            .map((z) => z.toString())
            .join(", ")}`,
      });
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   build(context: SqlBuildContext, _options?: SqlBuildOptions) {
      const [keyword, exists] = context.keywords();

      switch (true) {
         case keyword === "fn":
            context.addStrings("*");
            break;
         case keyword === "select" && exists === "exists":
            context.addStrings("*");
            break;
         default: {
            context.addQuotes(`${context.getQueryName(this)}.*`);

            // let index = 0;
            // for (const column of Object.values(this.row)) {
            //    if (index++ > 0) context.addStrings(", ");
            //    column.build(context, options);
            // }
         }
      }
   }
}

export type NullOrSqlSelectAll<T> = T extends Record<string, unknown> ? SqlSelectAll<{ Row: T }> : null;
