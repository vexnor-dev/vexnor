import { SqlTable } from "#/core/schema/sql-table.js";
import { ok } from "assert";
import { sql } from "#/core/sql.js";
import { SqlQuery, SqlQueryExtended } from "#/core/query/sql-query.js";
import { ParamsOfArgs } from "#/core/sql-base.js";
import { row } from "#/core/query/sql-select-row.js";
import { SqlQueryInfo } from "#/core/charms/sql-query-info.js";
import { raw } from "#/core/query/sql-raw.js";

export type SqlInsertFromArgs<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> = {
   FROM: SqlQuery<{ Row: T["Insert"] }>;
};

export type SqlInsertFromResult<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlInsertFromArgs<T>,
> = SqlQueryExtended<{
   Row: T["Select"];
   Params: ParamsOfArgs<Args>;
}>;

export function sqlInsertFrom<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlInsertFromArgs<T>,
>(table: SqlTable<T>, args: Args, info?: SqlQueryInfo | null): SqlInsertFromResult<T, Args> {
   ok(args?.FROM, `Args 'FROM' is required for 'insertFrom()' CRUD.`);

   const from = args.FROM;
   return sql`
      ${info ?? raw.BLANK}
      insert into ${table}
         ${from}
         returning ${row(table.$$)}
   ` as never as SqlInsertFromResult<T, Args>;
}
