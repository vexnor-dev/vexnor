import { SqlQuery, SqlQueryAny } from "#/core/query/sql-query.js";
import { SqlTable } from "#/core/schema/sql-table.js";
import { ok } from "#/lib/assert.js";
import { sql } from "#/core/sql.js";
import { raw } from "#/core/query/sql-raw.js";
import { row } from "#/core/query/sql-select-row.js";
import { ParamsOfArgs } from "#/core/sql-base.js";
import { SqlQueryInfo } from "#/core/charms/sql-query-info.js";

/**
 * Arguments for the crud `delete` command.
 *
 * Requires either a `WHERE` condition to scope the delete, or `{ force: true }`
 * to explicitly allow a full-table delete. This prevents accidental unfiltered deletes.
 */
export type SqlDeleteArgs = { WHERE: SqlQueryAny } | { force: true };

export type SqlDeleteResult<T extends { Select: Record<string, unknown> }, Args extends SqlDeleteArgs> = SqlQuery<{
   Select: T["Select"];
   Params: ParamsOfArgs<Args>;
}>;

export function sqlDelete<T extends { Select: Record<string, unknown>; Delete: true }, Args extends SqlDeleteArgs>(
   table: SqlTable<T>,
   args: Args,
   // eslint-disable-next-line unused-imports/no-unused-vars
   _info?: SqlQueryInfo | null,
): SqlDeleteResult<T, Args> {
   if (!isWhere(args)) {
      ok((args as { force?: boolean }).force, "WHERE condition or force required");
   }

   return sql`
         delete
         from ${table}
            ${isWhere(args) ? sql`where ${(args.where ?? args.WHERE)!.inline()}` : raw.BLANK}
         returning
            ${row(table.$$)}
      ` as SqlDeleteResult<T, Args>;
}

function isWhere(value: unknown): value is { where?: SqlQueryAny; WHERE?: SqlQueryAny } {
   if (!value) return false;
   if (typeof value !== "object") return false;
   return "WHERE" in value && value.WHERE instanceof SqlQuery;
}
