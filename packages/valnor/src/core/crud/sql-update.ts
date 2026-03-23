import { SqlQueryAny, SqlQueryExtended } from "#/core/query/sql-query.js";
import { ParamsOfArgs } from "#/core/sql-base.js";
import { SqlTable } from "#/core/schema/sql-table.js";
import { expand } from "#/core/query/sql-expand.js";
import { SqlQueryRefAny } from "#/core/query/sql-query-ref.js";
import { ok } from "#/lib/assert.js";
import { isPrimitive } from "#/lib/primitive.js";
import { sql } from "#/core/sql.js";
import { raw } from "#/core/query/sql-raw.js";
import { row } from "#/core/query/sql-select-row.js";
import { Void } from "#/core/utils/utility-types.js";
import { SqlQueryInfo } from "#/core/charms/sql-query-info.js";

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
   const expandSetValues = buildUpdateSetExpand(table);
   return sql`
      ${info ?? raw.BLANK}
      update ${table}
         ${expandSetValues}
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

export function buildUpdateSetExpand<T extends { Select: Record<string, unknown>; Update: Record<string, unknown> }>(
   table: SqlTable<T>,
) {
   return expand<SqlUpdateParameters<T>>((params) => {
      if (!params?.set) return null;
      const setValues: SqlQueryRefAny[] = [];
      for (const [key, value] of Object.entries(params.set)) {
         const col = table.cols[`$${key}`];
         ok(col, `Column not found: ${key}`);
         ok(isPrimitive(value), `Value it's not a primitive: ${value}`);
         setValues.push(sql`${col} = ${value}`.inline());
      }
      return sql`set ${setValues}`.inline();
   });
}
