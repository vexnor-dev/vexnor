// noinspection SqlNoDataSourceInspection,SqlResolve
import { SqlTable } from "#src/core/schema/sql-table.js";
import { sql } from "#src/core/sql.js";
import { raw } from "#src/core/query/sql-raw.js";
import { row } from "#src/core/query/sql-select-row.js";
import { insert } from "#src/core/operators/sql-insert-x.js";
import { SqlQueryInfo } from "#src/core/charms/sql-query-info.js";
import { SqlInsertRowsResult } from "#src/core/crud/sql-insert-rows.js";

/**
 * Class-based equivalent of the `sqlInsertRows()` function.
 *
 * Receives `table` in the constructor and composes the INSERT SQL via `build()`.
 * Plugin subclasses override `build()` to emit dialect-specific SQL
 * (e.g., MSSQL splits cols/values and uses OUTPUT instead of RETURNING).
 */
export class SqlInsertRowsCommand<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
> {
   protected readonly table: SqlTable<T>;
   protected readonly info: SqlQueryInfo | null;

   constructor(table: SqlTable<T>, info?: SqlQueryInfo | null) {
      this.table = table;
      this.info = info ?? null;
   }

   /**
    * Composes the INSERT INTO ... RETURNING query using the insert() operator.
    */
   build(): SqlInsertRowsResult<{ Select: T["Select"]; Insert: T["Insert"] }, "rows"> {
      const { table, info: queryInfo } = this;

      return sql`
         ${queryInfo ?? raw.BLANK}
         insert into ${table}
            ${insert(table, "rows")}
            returning ${row(table.$$)}
      ` as unknown as SqlInsertRowsResult<{ Select: T["Select"]; Insert: T["Insert"] }, "rows">;
   }
}
