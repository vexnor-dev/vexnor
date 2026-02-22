import { ROW, TYPE } from "../sql-base.js";
import { SqlBuildContext, SqlBuildOptions, SqlQueryAny } from "../query/index.js";
import { Sql } from "../sql-base.js";
import { InferSelectRowByResult } from "./sql-query-types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlSelectAllAny = SqlSelectAll<any>;

export class SqlSelectAll<Row extends Record<string, unknown>> extends Sql {
   declare readonly [TYPE]: Row;
   declare readonly [ROW]: Row;

   readonly row: InferSelectRowByResult<Row>;
   readonly query: SqlQueryAny;

   constructor({ row, query }: { row: InferSelectRowByResult<Row>; query: SqlQueryAny }) {
      super({
         id: `${Object.keys(row)
            .map((z) => z.toString())
            .join(", ")}`,
      });
      this.row = row;
      this.query = query;
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   build(context: SqlBuildContext, _options?: SqlBuildOptions) {
      const [keyword, exists] = context.keywords();

      const queryName = context.getQueryName(this.query);

      switch (true) {
         case keyword === "fn":
            context.addStrings(`"${queryName}".*`);
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
