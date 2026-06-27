import { PARAMS, Sql, SqlOptions } from "#src/core/sql-base.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { PathToNested, SqlParam } from "#src/core/query/sql-param.js";
import { resolvePath } from "#src/core/query/resolve-path.js";

/**
 * Pagination params shape for CRUD select.
 */
export type SqlPaginationParams = {
   limit?: number | null;
   offset?: number | null;
};

/**
 * Portable LIMIT/OFFSET operator. Reads `params.limit` and `params.offset`
 * at runtime and emits the appropriate SQL clause. Produces no output if both are absent.
 *
 * @example
 * params: { limit: 25, offset: 0 }
 * // → LIMIT $1 OFFSET $2
 *
 * params: { limit: 10 }
 * // → LIMIT $1
 *
 * params: {}
 * // → (nothing)
 */
export class SqlPagination extends Sql {
   declare readonly [PARAMS]: PathToNested<"limit", number | undefined> & PathToNested<"offset", number | undefined>;

   readonly params: Record<string, SqlParam<{ Name: string; Type: unknown }>>;

   constructor() {
      super({
         type: "SqlPagination",
         id: "pagination",
         hashId: "pagination",
      } satisfies SqlOptions);

      this.params = {
         limit: new SqlParam({ name: "limit", validation: { min: 0 } }),
         offset: new SqlParam({ name: "offset", validation: { min: 0 } }),
      };
   }

   write(context: SqlBuildContext): void {
      if (!context.params) {
         context.addOperator({ type: "pagination" });
         return;
      }

      const params = context.params as Record<string, unknown>;
      const limit = resolvePath(params, "limit") as number | null | undefined;
      const offset = resolvePath(params, "offset") as number | null | undefined;

      if (limit != null) {
         context.addStrings("limit ");
         context.addValues(limit);
      }

      if (offset != null) {
         if (limit != null) context.addStrings(" ");
         context.addStrings("offset ");
         context.addValues(offset);
      }
   }
}
