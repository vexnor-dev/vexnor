import { SqlParam } from "./query/sql-param.js";
import { SqlQueryContext } from "./query/sql-query-context.js";

export class SqlArray<TName extends string> extends SqlParam<TName> {
   build(context: SqlQueryContext) {
      super.build(context);
   }
}
