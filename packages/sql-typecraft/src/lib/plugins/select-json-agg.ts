import { Sql } from "../sql-base.js";
import { SqlQueryContext } from "../sql-query-context.js";
import { RowOut } from "../sql-types.js";
import { SqlQuery } from "../sql-query.js";

export class SelectJsonAgg<
   TRow extends RowOut,
   TParams extends Record<string, unknown> | undefined = undefined,
> extends Sql {
   constructor(public readonly select: SqlQuery<TRow, TParams>) {
      super();
   }

   build(context: SqlQueryContext) {
      switch (context.keyword) {
         case "select": {
            const select = `coalesce(
                         jsonb_agg("${this.select.name}".*) filter (where "${this.select.name}".* is not null),
                         '[]'
                      )`;
            context.strings.push(select);
            break;
         }
         case "from":
            context.strings.push(`"${this.select.name}"`);
            break;
         case "join": {
            this.select.build(context);
            context.strings.push(` on true`);
            break;
         }
         default:
            throw new Error(`Unknown keyword: ${context.keyword}`);
      }
   }
}

export function jsonAgg<TRow extends RowOut, TParams extends Record<string, unknown> | undefined = undefined>(
   select: SqlQuery<TRow, TParams>,
) {
   return new SelectJsonAgg(select);
}
