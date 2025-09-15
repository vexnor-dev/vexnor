import { SqlParam } from "./sql-param.js";
import { SqlQueryContext } from "./sql-query-context.js";

export class SqlArray<TName extends string> extends SqlParam<TName> {
   build(context: SqlQueryContext) {
      super.build(context);
   }
}
