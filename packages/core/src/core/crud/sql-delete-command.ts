// noinspection SqlNoDataSourceInspection,SqlResolve
import { SqlTable } from "#src/core/schema/sql-table.js";
import { ok } from "#src/lib/assert.js";
import { sql } from "#src/core/sql.js";
import { raw } from "#src/core/query/sql-raw.js";
import { row } from "#src/core/query/sql-select-row.js";
import { SqlQueryInfo } from "#src/core/charms/sql-query-info.js";
import { SqlDeleteArgs, SqlDeleteResult } from "#src/core/crud/sql-delete.js";

/**
 * Class-based equivalent of the `sqlDelete()` function.
 *
 * Receives `table` and `args` in the constructor and composes the
 * DELETE SQL via `build()`. Plugin subclasses override `build()` to
 * emit dialect-specific SQL (e.g., OUTPUT deleted vs RETURNING).
 */
export class SqlDeleteCommand<
   T extends { Select: Record<string, unknown>; Delete: true },
   Args extends SqlDeleteArgs,
> {
   protected readonly table: SqlTable<T>;
   protected readonly args: Args;
   protected readonly info: SqlQueryInfo | null;

   constructor(table: SqlTable<T>, args: Args, info?: SqlQueryInfo | null) {
      this.table = table;
      this.args = args;
      this.info = info ?? null;

      if (!this.hasWhere(args)) {
         ok((args as { force?: boolean }).force, "WHERE condition or force required");
      }
   }

   /**
    * Composes the DELETE query with optional WHERE and RETURNING.
    */
   build(): SqlDeleteResult<T, Args> {
      const { table, args, info: queryInfo } = this;
      const where = this.hasWhere(args) ? args.WHERE : undefined;

      return sql`
         ${queryInfo ?? raw.BLANK}
         delete
         from ${table}
            ${where ? sql`where ${where.inline()}` : raw.BLANK}
         returning
            ${row(table.$$)}
      ` as SqlDeleteResult<T, Args>;
   }

   protected hasWhere(value: unknown): value is { WHERE: unknown } {
      if (!value) return false;
      if (typeof value !== "object") return false;
      return "WHERE" in value && value.WHERE != null;
   }
}
