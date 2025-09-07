import { Sql } from "./sql-base.js";
import { SqlQueryContext } from "./sql-query-context.js";
import { RowOut, SqlBuild } from "./sql-types.js";
import { SqlQuery } from "./sql-query.js";

export class SqlJsonAgg<
   TRow extends RowOut,
   TParams extends Record<string, unknown> | undefined = undefined,
> extends Sql {
   constructor(
      public readonly name: string,
      public readonly select: SqlQuery<TRow, TParams>,
   ) {
      super();
   }

   build(context: SqlQueryContext): SqlBuild {
      switch (context.keyword) {
         case "select": {
            const select = `coalesce(
                         jsonb_agg("${this.name}.*") filter (where "${this.name}.*" is not null),
                         '[]'
                      ) as "${this.name}"`;
            return { strings: [select] };
         }
         case "from":
            return { strings: [`"${this.name}"`] };
         case "join": {
            const { strings, values } = this.select.build(context);
            return { strings: ["left join lateral", "(", ...strings, ")", `"${this.name}" on true`], values };
         }
         default:
            throw new Error(`Unknown keyword: ${context.keyword}`);
      }
   }
}

export function jsonAgg<TRow extends RowOut, TParams extends Record<string, unknown> | undefined = undefined>({
   name,
   select,
}: {
   name: string;
   select: SqlQuery<TRow, TParams>;
}) {
   return new SqlJsonAgg(name, select);
}
