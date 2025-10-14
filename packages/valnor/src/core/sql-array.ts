import { SqlParam, SqlQueryContext } from "./query/index.js";

export class SqlArray<TName extends string> extends SqlParam<TName> {
   build(context: SqlQueryContext) {
      super.build(context);
   }
}
