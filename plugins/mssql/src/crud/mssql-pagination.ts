import { Sql, SqlBuildContext, SqlParam } from "@vexnor/core";

/**
 * MSSQL pagination: OFFSET X ROWS FETCH NEXT Y ROWS ONLY
 */
export class MssqlPagination extends Sql {
   readonly params: Record<string, SqlParam<{ Name: string; Type: unknown }>>;

   constructor() {
      super({ type: "MssqlPagination", id: "mssql-pagination", hashId: "mssql-pagination" });
      this.params = {
         offset: new SqlParam({ name: "offset", validation: { min: 0 } }),
         limit: new SqlParam({ name: "limit", validation: { min: 0 } }),
      };
   }

   write(context: SqlBuildContext): void {
      if (!context.params) {
         context.addOperator({ type: "pagination" });
         return;
      }

      const params = context.params as Record<string, unknown>;
      const limit = params["limit"] as number | null | undefined;
      const offset = params["offset"] as number | null | undefined;

      if (offset != null) {
         context.addStrings("offset ");
         context.addValues(offset);
         context.addStrings(" rows");
      } else if (limit != null) {
         context.addStrings("offset ");
         context.addValues(0);
         context.addStrings(" rows");
      }

      if (limit != null) {
         context.addStrings(" fetch next ");
         context.addValues(limit);
         context.addStrings(" rows only");
      }
   }
}
