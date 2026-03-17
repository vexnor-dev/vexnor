import { ARGS, PARAMS, Sql, TYPE } from "#/core/sql-base.js";
import { QUERY, SqlQuery, SqlQueryColumns } from "#/core/query/sql-query.js";
import { SqlQueryOptions } from "#/core/query/sql-query-types.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#/core/builder/sql-build-options.js";
import { CACHE } from "#/lib/cache.js";
import { SqlBuildError } from "#/core/sql-build-error.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryRefAny = SqlQueryRef<any>;

export type SqlQueryRefExtended<T extends { Row?: unknown; Params?: unknown }> = SqlQueryRef<T> &
   SqlQueryColumns<T["Row"]>;

export class SqlQueryRef<T extends { Row?: unknown; Params?: unknown }> extends Sql {
   declare readonly [QUERY]: SqlQuery<T>;
   declare readonly [TYPE]: T["Row"];
   declare readonly [PARAMS]: T["Params"];
   declare readonly [ARGS]: T["Params"];

   constructor(
      public readonly innerQuery: SqlQuery<T>,
      public readonly scope: SqlQueryOptions | null,
      public readonly recursive = false,
   ) {
      super({
         id: innerQuery.id,
      });
   }

   get $$() {
      return this.innerQuery.$$;
   }

   write(context: SqlBuildContext, options?: SqlBuildOptions | null): void {
      if (this.recursive) {
         context.addStrings(`"${context.getQueryName(-1)}"`);
         return;
      }

      this.innerQuery.build(context, options, this.scope);
   }
}

export function newSqlQueryRef<T extends { Row?: unknown; Params?: unknown }>(
   innerQuery: SqlQuery<T>,
   scope: SqlQueryOptions | null,
   recursive = false,
): SqlQueryRefExtended<T> {
   let cacheKey: string[] | undefined = undefined;
   switch (true) {
      case recursive:
         cacheKey = [innerQuery.id, "recursive"];
         break;
      case scope !== null:
         cacheKey = [
            innerQuery.id,
            `paramKey=${scope.paramKey ?? "?"}`,
            `queryType=${scope.queryType ?? "?"}`,
            `queryFormat=${scope.queryFormat ?? "?"}`,
         ];
         break;
      default:
         throw new SqlBuildError(`Invalid args for creating query ref for '${innerQuery.id}`);
   }

   const target = CACHE.get<SqlQueryRef<T>>(cacheKey, () => new SqlQueryRef(innerQuery, scope, recursive));
   return Object.assign(target, innerQuery.row);
}
