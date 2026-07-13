// noinspection SqlNoDataSourceInspection,SqlResolve
import { SqlTable } from "#src/core/schema/sql-table.js";
import { ok } from "#src/lib/assert.js";
import { sql } from "#src/core/sql.js";
import { raw } from "#src/core/query/sql-raw.js";
import { row } from "#src/core/query/sql-select-row.js";
import { SqlQueryInfo } from "#src/core/charms/sql-query-info.js";
import { SqlInsertFromArgs, SqlInsertFromResult } from "#src/core/crud/sql-insert-from.js";

/**
 * Class-based equivalent of the `sqlInsertFrom()` function.
 *
 * Receives `table` and `args` in the constructor and composes the
 * INSERT ... FROM SQL via `build()`. Plugin subclasses override `build()`
 * to emit dialect-specific SQL (e.g., MSSQL uses OUTPUT instead of RETURNING).
 */
export class SqlInsertFromCommand<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlInsertFromArgs<T>,
> {
   protected readonly table: SqlTable<T>;
   protected readonly args: Args;
   protected readonly info: SqlQueryInfo | null;

   constructor(table: SqlTable<T>, args: Args, info?: SqlQueryInfo | null) {
      this.table = table;
      this.args = args;
      this.info = info ?? null;

      ok(args?.FROM, `Args 'FROM' is required for 'insertFrom()' CRUD.`);
   }

   /**
    * Composes the INSERT INTO ... (FROM subquery) RETURNING query.
    */
   build(): SqlInsertFromResult<T, Args> {
      const { table, args, info: queryInfo } = this;

      return sql`
         ${queryInfo ?? raw.BLANK}
         insert into ${table}
            ${args.FROM}
            returning ${row(table.$$)}
      ` as never as SqlInsertFromResult<T, Args>;
   }
}
