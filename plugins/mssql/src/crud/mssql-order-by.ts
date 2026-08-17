import { SqlBuildContext, SqlOrderBy } from "@vexnor/core";

/**
 * MSSQL requires ORDER BY whenever OFFSET/FETCH pagination is used.
 * Preserve an explicit runtime order and use an intentionally unordered
 * fallback only when pagination is requested without one.
 */
export class MssqlOrderBy<
   T extends { Select: Record<string, unknown> },
   ParamName extends string,
> extends SqlOrderBy<T, ParamName> {
   override write(context: SqlBuildContext): void {
      if (!context.params) {
         super.write(context);
         return;
      }

      const orderBy = context.params[this.paramName];
      const hasOrderBy = typeof orderBy === "object" && orderBy !== null && Object.keys(orderBy).length > 0;

      super.write(context);

      const hasPagination = context.params["limit"] != null || context.params["offset"] != null;
      if (hasPagination && !hasOrderBy) {
         context.addStrings("order by (select null)");
      }
   }
}
