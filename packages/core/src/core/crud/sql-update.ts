// noinspection SqlNoDataSourceInspection,SqlResolve
import { SqlQueryAny, SqlQueryExtended } from "#src/core/query/sql-query.js";
import { ParamsOfArgs } from "#src/core/sql-base.js";
import { SqlTable } from "#src/core/schema/sql-table.js";
import { set } from "#src/core/operators/sql-set.js";
import { sql } from "#src/core/sql.js";
import { raw } from "#src/core/query/sql-raw.js";
import { row } from "#src/core/query/sql-select-row.js";
import { Void } from "#src/core/utils/utility-types.js";
import { SqlQueryInfo } from "#src/core/charms/sql-query-info.js";

/**
 * Arguments for the crud `update` command.
 *
 * - `WHERE` — filter condition (without the `WHERE` keyword); omit only if the
 *   plugin implementation allows unfiltered updates
 */
export type SqlUpdateArgs = {
   WHERE?: SqlQueryAny;
};

export type SqlUpdateParameters<T extends { Update: Record<string, unknown> }> = { set: T["Update"] };

export type SqlTableUpdateResult<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlUpdateArgs,
> = SqlQueryExtended<{
   Row: T["Select"];
   Params: Void<SqlUpdateParameters<T> & ParamsOfArgs<Args>>;
}>;

export function sqlUpdate<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlUpdateArgs,
>(table: SqlTable<T>, args: Args, info?: SqlQueryInfo | null): SqlTableUpdateResult<T, Args> {
   return sql`
      ${info ?? raw.BLANK}
      update ${table}
         ${set(table, "set")}
         ${
            args.WHERE
               ? sql`
                  where
                  ${args.WHERE.inline()}`.inline()
               : raw.BLANK
         }
         returning ${row(table.$$)}
   ` as unknown as SqlTableUpdateResult<T, Args>;
}

