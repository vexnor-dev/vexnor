import {
   Sql,
   SqlSelectCommand,
   SqlTable,
   SqlSelectArgs,
   SqlSelectHooks,
   SqlTableAny,
   SqlQueryBaseAny,
   ParamsOfArgs,
   SqlSelectResultRow,
   SqlQueryColumns,
   info,
   type SqlFilterParams,
   type SqlOrderByParams,
   type SqlPaginationParams,
   type SqlHavingByParams,
   type SqlWindowByParams,
   type SqlProjectByParams,
} from "@vexnor/core";
import { PostgresProjectBy } from "#src/crud/postgres-project-by.js";
import { jsonMany, jsonOne } from "#src/charms/json-aggregation-postgres.js";
import { PostgresQueryHandler } from "#src/postgres-query-handler.js";
import "#src/postgres-augment.js";

export { PostgresProjectBy } from "#src/crud/postgres-project-by.js";

export type PostgresSelectCommandResult<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs<T>,
> = PostgresQueryHandler<{
   Row: SqlSelectResultRow<T, Args>;
   Params: (ParamsOfArgs<Args> extends void ? unknown : ParamsOfArgs<Args>)
      & SqlFilterParams<T, "filterBy">
      & SqlOrderByParams<T, "orderBy">
      & SqlPaginationParams
      & SqlProjectByParams<T>
      & SqlHavingByParams
      & SqlWindowByParams<T>;
}> &
   SqlQueryColumns<SqlSelectResultRow<T, Args>>;

/**
 * PostgreSQL-specific select command that:
 * 1. Handles `includeOne`/`includeMany` via lateral joins (jsonOne/jsonMany)
 * 2. Uses `PostgresProjectBy` for boolean-safe aggregates
 * 3. Passes `info({ driver: 'postgres' })` via the constructor
 * 4. Returns the `.postgres` handler
 */
export class PostgresSelectCommand<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs<T>,
> extends SqlSelectCommand<T, Args> {
   constructor(table: SqlTable<T>, args: Args) {
      const pgInfo = info({ driver: "postgres" });

      // Compute include hooks before calling super — super needs them for validation
      const { includeOne, includeMany, ...baseArgs } = args;
      const ones = Object.entries(includeOne ?? {}).map(([k, q]) => ({
         key: k,
         charm: jsonOne(q as SqlQueryBaseAny),
      }));
      const manys = Object.entries(includeMany ?? {}).map(([k, q]) => ({
         key: k,
         charm: jsonMany(q as SqlQueryBaseAny),
      }));

      const hooks: SqlSelectHooks | undefined =
         ones.length || manys.length
            ? {
                 afterSelect: [...ones, ...manys].map(({ key, charm }) => charm.as(key)),
                 afterFrom: [...ones.map(({ charm }) => charm), ...manys.map(({ charm }) => charm)],
              }
            : undefined;

      super(table, baseArgs as Args, pgInfo, undefined, undefined, hooks);
   }

   /**
    * Override to return PostgresProjectBy which auto-casts boolean columns
    * to `::int` for SUM/AVG aggregates.
    */
   protected override createProjectionNode(fieldNames: string[]): Sql {
      return new PostgresProjectBy<SqlProjectByParams<T>>(this.table as SqlTableAny, "select", fieldNames);
   }

   /**
    * Override createIncludes to provide jsonOne/jsonMany-based lateral join includes.
    * Note: In this implementation, includes are passed via hooks in the constructor,
    * so this returns null. The hook-based approach is used for compatibility with
    * the existing architecture.
    */
   protected override createIncludes(): { afterSelect: Sql[]; afterFrom: Sql[] } | null {
      return null;
   }

   /**
    * Builds the query and returns the `.postgres` handler with full type inference.
    */
   execute(): PostgresSelectCommandResult<T, Args> {
      return this.build().postgres as PostgresSelectCommandResult<T, Args>;
   }
}
