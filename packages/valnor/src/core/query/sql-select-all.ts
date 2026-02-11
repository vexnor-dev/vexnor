import { ROW, TYPE } from "../sql-base.js";
import { InferSelectRowByResult, SqlBuildContext, SqlBuildOptions } from "../query/index.js";
import { Sql } from "../sql-base.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlSelectAllAny = SqlSelectAll<any>;

export class SqlSelectAll<Row extends Record<string, unknown>> extends Sql {
   declare readonly [TYPE]: Row;
   declare readonly [ROW]: Row;

   constructor(public readonly row: InferSelectRowByResult<Row>) {
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
         }
      }
   }
}
