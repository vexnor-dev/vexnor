// noinspection SqlNoDataSourceInspection,SqlResolve
import { SqlTable } from "#src/core/schema/sql-table.js";
import { set } from "#src/core/operators/sql-set.js";
import { sql } from "#src/core/sql.js";
import { raw } from "#src/core/query/sql-raw.js";
import { row } from "#src/core/query/sql-select-row.js";
import { SqlQueryInfo } from "#src/core/charms/sql-query-info.js";
import { SqlUpdateArgs, SqlTableUpdateResult } from "#src/core/crud/sql-update.js";

/**
 * Class-based equivalent of the `sqlUpdate()` function.
 *
 * Receives `table` and `args` in the constructor and composes the
 * UPDATE SQL via `build()`. Plugin subclasses override `build()` to
 * emit dialect-specific SQL (e.g., OUTPUT vs RETURNING).
 */
export class SqlUpdateCommand<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlUpdateArgs,
> {
   protected readonly table: SqlTable<T>;
   protected readonly args: Args;
   protected readonly info: SqlQueryInfo | null;

   constructor(table: SqlTable<T>, args: Args, info?: SqlQueryInfo | null) {
      this.table = table;
      this.args = args;
      this.info = info ?? null;
   }

   /**
    * Composes the UPDATE query with SET, optional WHERE, and RETURNING.
    */
   build(): SqlTableUpdateResult<T, Args> {
      const { table, args, info: queryInfo } = this;

      return sql`
         ${queryInfo ?? raw.BLANK}
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
}
