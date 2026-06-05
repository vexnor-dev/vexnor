import { SqlQueryAny, SqlQueryExtended } from "#/core/query/sql-query.js";
import { SqlParam } from "#/core/query/sql-param.js";
import { Simplify } from "#/core/utils/utility-types.js";
import { ParamsOfArgs, TypeOf } from "#/core/sql-base.js";
import { SqlTable } from "#/core/schema/sql-table.js";
import { ok, strictEqual } from "#/lib/assert.js";
import { sql } from "#/core/sql.js";
import { raw } from "#/core/query/sql-raw.js";
import { SqlQueryInfo } from "#/core/charms/sql-query-info.js";
import { row } from "#/core/query/sql-select-row.js";

/**
 * Arguments for the crud `select` command.
 *
 * All clauses are optional — omit any you don't need. Each value is a `SqlQuery`
 * fragment that gets inlined into the appropriate position in the generated SELECT.
 *
 * - `SELECT` — override the default `SELECT *` with a custom column list
 * - `WHERE` — filter condition (without the `WHERE` keyword)
 * - `JOIN` — one or more JOIN clauses
 * - `GROUP_BY` / `HAVING` — grouping and group filter
 * - `ORDER_BY` — sort order
 * - `offset` / `limit` — pagination params (plugin-dependent support)
 * - `includeOne` / `includeMany` — lateral JSON includes (plugin-dependent support)
 */
export type SqlSelectArgs = {
   SELECT?: SqlQueryAny;
   WHERE?: SqlQueryAny;
   JOIN?: SqlQueryAny;
   GROUP_BY?: SqlQueryAny;
   HAVING?: SqlQueryAny;
   ORDER_BY?: SqlQueryAny;
   offset?: SqlParam<{ Name: "offset"; Type: number }>;
   limit?: SqlParam<{ Name: "limit"; Type: number }>;
   includeOne?: Record<string, SqlQueryAny>;
   includeMany?: Record<string, SqlQueryAny>;
};

export type SqlSelectResult<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs,
> = SqlQueryExtended<{
   Row: SqlSelectResultRow<T, Args>;
   Params: ParamsOfArgs<Args>;
}>;

export type SqlSelectResultRow<T extends { Select: Record<string, unknown> }, Args extends SqlSelectArgs> = Simplify<
   SqlTableReadRowSelect<T, Args> & SqlTableReadRowIncludeOne<Args> & SqlTableReadRowIncludeMany<Args>
>;

export function sqlSelect<T extends { Select: Record<string, unknown> }, Args extends SqlSelectArgs>(
   table: SqlTable<T>,
   args: Args,
   info?: SqlQueryInfo | null,
): SqlSelectResult<T, Args> {
   const { includeOne, includeMany } = args;
   ok(!includeMany || Object.keys(includeMany).length === 0, `'includeMany' not supported by default SqlTableRead.`);
   ok(!includeOne || Object.keys(includeOne).length === 0, `'includeOne' not supported by default SqlTableRead.`);
   strictEqual(args.offset, undefined, `'offset' not supported by default SqlTableRead.`);
   strictEqual(args.limit, undefined, `'limit' not supported by default SqlTableRead.`);

   if (args.JOIN) {
      ok(args.JOIN.rawStrings[0]?.toLowerCase().includes("join"), `'JOIN' criteria not including SQL keyword 'join'`);
   }

   return sql`
         ${info ?? raw.BLANK}
         select
         ${args.SELECT ? args.SELECT.inline() : row(table.$$)}
         from ${table}
         ${args.JOIN ? args.JOIN.inline() : raw.BLANK}
         ${args.WHERE ? sql`where ${args.WHERE.inline()}`.inline("default") : raw.BLANK}
         ${args.GROUP_BY ? sql`group by ${args.GROUP_BY.inline()}`.inline("default") : raw.BLANK}
         ${args.HAVING ? sql`having ${args.HAVING.inline()}`.inline("default") : raw.BLANK}
         ${args.ORDER_BY ? sql`order by ${args.ORDER_BY.inline()}`.inline("default") : raw.BLANK}
      ` as unknown as SqlSelectResult<T, Args>;
}

export function expandFromClause<T extends { Select: Record<string, unknown> }>(
   table: SqlTable<T>,
   args: Pick<SqlSelectArgs, "JOIN" | "WHERE" | "GROUP_BY" | "HAVING" | "ORDER_BY">,
) {
   return sql`
      from ${table}
      ${args.JOIN ? args.JOIN.inline() : raw.BLANK}
      ${args.WHERE ? sql`where ${args.WHERE.inline()}`.inline("default") : raw.BLANK}
      ${args.GROUP_BY ? sql`group by ${args.GROUP_BY.inline()}`.inline("default") : raw.BLANK}
      ${args.HAVING ? sql`having ${args.HAVING.inline()}`.inline("default") : raw.BLANK}
      ${args.ORDER_BY ? sql`order by ${args.ORDER_BY.inline()}`.inline("default") : raw.BLANK}
   `;
}

export type SqlTableReadRowSelect<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs,
> = Args["SELECT"] extends SqlQueryAny ? TypeOf<Args["SELECT"]> : T["Select"];

export type SqlTableReadRowIncludeOne<Args> = Args extends {
   includeOne: Record<string, SqlQueryAny>;
}
   ? {
        [K in keyof Args["includeOne"]]: TypeOf<Args["includeOne"][K]> | null;
     }
   : unknown;

export type SqlTableReadRowIncludeMany<Args> = Args extends {
   includeMany: Record<string, SqlQueryAny>;
}
   ? {
        [K in keyof Args["includeMany"]]: TypeOf<Args["includeMany"][K]>[];
     }
   : unknown;
