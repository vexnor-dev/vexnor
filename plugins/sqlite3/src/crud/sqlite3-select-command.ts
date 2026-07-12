import {
   Sql,
   SqlTable,
   SqlSelectCommand,
   SqlSelectArgs,
   ParamsOfArgs,
   SqlSelectResultRow,
   info,
   SqlQueryColumns,
   SqlQueryBaseAny,
} from "@vexnor/core";
import { jsonMany, jsonOne } from "#src/charms/json-aggregation-sqlite3.js";
import { BetterSqlite3QueryHandler } from "#src/better-sqlite3-query-handler.js";
import "#src/sqlite3-augment.js";

export type Sqlite3SelectCommandResult<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs<T>,
> = BetterSqlite3QueryHandler<{
   Row: SqlSelectResultRow<T, Args>;
   Params: ParamsOfArgs<Args>;
}> &
   SqlQueryColumns<SqlSelectResultRow<T, Args>>;

/**
 * SQLite3-specific select command.
 *
 * Extends `SqlSelectCommand` to:
 * - Handle `includeOne`/`includeMany` via SQLite3 JSON aggregation (json_group_array / json_object)
 * - Only uses `afterSelect` (no `afterFrom` — SQLite3 subqueries are scalar in the SELECT list)
 * - Tag queries with `info({ driver: 'sqlite' })`
 * - Return the `.sqlite` handler
 */
export class Sqlite3SelectCommand<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs<T>,
> extends SqlSelectCommand<T, Args> {
   private readonly includeOneArg: Record<string, SqlQueryBaseAny> | undefined;
   private readonly includeManyArg: Record<string, SqlQueryBaseAny> | undefined;

   constructor(table: SqlTable<T>, args: Args) {
      const { includeOne, includeMany, ...baseArgs } = args;

      super(
         table,
         baseArgs as Args,
         info({ driver: "sqlite" }),
         undefined,
         undefined,
         undefined,
      );

      this.includeOneArg = includeOne;
      this.includeManyArg = includeMany;
   }

   protected override createIncludes(): { afterSelect: Sql[]; afterFrom: Sql[] } | null {
      const ones = Object.entries(this.includeOneArg ?? {}).map(([k, q]) => ({
         key: k,
         charm: jsonOne(q.source),
      }));
      const manys = Object.entries(this.includeManyArg ?? {}).map(([k, q]) => ({
         key: k,
         charm: jsonMany(q.source),
      }));

      if (!ones.length && !manys.length) return null;

      return {
         afterSelect: [
            ...ones.map(({ key, charm }) => charm.as(key)),
            ...manys.map(({ key, charm }) => charm.as(key)),
         ],
         afterFrom: [],
      };
   }

   /**
    * Builds the query and returns the `.sqlite` handler with full type inference.
    */
   execute(): Sqlite3SelectCommandResult<T, Args> {
      return this.build().sqlite as Sqlite3SelectCommandResult<T, Args>;
   }
}
