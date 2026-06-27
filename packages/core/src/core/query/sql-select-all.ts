import { ROW, TYPE } from "#src/core/sql-base.js";
import { Sql } from "#src/core/sql-base.js";
import { InferSelectRowByResult } from "#src/core/query/sql-query-types.js";
import { SqlQueryAny } from "#src/core/query/sql-query.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#src/core/builder/sql-build-options.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlSelectAllAny = SqlSelectAll<any>;

export class SqlSelectAll<Row extends Record<string, unknown>> extends Sql {
   declare readonly [TYPE]: Row;
   declare readonly [ROW]: Row;

   readonly row: InferSelectRowByResult<Row>;
   readonly innerQuery: SqlQueryAny;

   constructor({ row, innerQuery }: { row: InferSelectRowByResult<Row>; innerQuery: SqlQueryAny }) {
      super({
         type: "SqlSelectAll",
         id: `${Object.keys(row)
            .map((z) => z.toString())
            .join(", ")}`,
         hashId: innerQuery.hashId,
      });
      this.row = row;
      this.innerQuery = innerQuery;
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   write(context: SqlBuildContext, _options?: SqlBuildOptions) {
      const [keyword, exists] = context.keywords();

      const queryName = context.getQueryName(this.innerQuery);

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
