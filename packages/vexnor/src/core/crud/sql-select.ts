// noinspection SqlNoDataSourceInspection,SqlResolve
import { SqlQueryAny, SqlQueryBaseAny, SqlQueryExtended } from "#/core/query/sql-query.js";
import { SqlParam } from "#/core/query/sql-param.js";
import { Simplify } from "#/core/utils/utility-types.js";
import { ParamsOfArgs, TypeOf } from "#/core/sql-base.js";
import { SqlTable } from "#/core/schema/sql-table.js";
import { ok } from "#/lib/assert.js";
import { sql } from "#/core/sql.js";
import { raw } from "#/core/query/sql-raw.js";
import { SqlQueryInfo } from "#/core/charms/sql-query-info.js";
import { SqlFilterBy, SqlFilterParams } from "#/core/operators/sql-filter-by.js";
import { SqlProjectBy, SqlProjectionGroupBy, SqlProjectByParams } from "#/core/operators/sql-project-by.js";
import { SqlOrderBy, SqlOrderByParams } from "#/core/operators/sql-order-by.js";
import { SqlPagination, SqlPaginationParams } from "#/core/operators/sql-pagination.js";

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
export type SqlSelectArgs<T extends { Select: Record<string, unknown> }> = {
   SELECT?: SqlQueryBaseAny;
   WHERE?: SqlQueryBaseAny;
   JOIN?: SqlQueryBaseAny;
   GROUP_BY?: SqlQueryBaseAny;
   HAVING?: SqlQueryBaseAny;
   ORDER_BY?: SqlQueryBaseAny;
   offset?: SqlParam<{ Name: "offset"; Type: number }>;
   limit?: SqlParam<{ Name: "limit"; Type: number }>;
   includeOne?: Record<string, SqlQueryBaseAny>;
   includeMany?: Record<string, SqlQueryBaseAny>;
   filterBy?: SqlFilterParams<T, "filterBy">;
   orderBy?: SqlOrderByParams<T, "orderBy">;
};

export type SqlSelectResult<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs<T>,
> = SqlQueryExtended<{
   Row: SqlSelectResultRow<T, Args>;
   Params: (ParamsOfArgs<Args> extends void ? unknown : ParamsOfArgs<Args>) & SqlFilterParams<T, "filterBy"> & SqlOrderByParams<T, "orderBy"> & SqlPaginationParams & SqlProjectByParams<T>;
}>;

export type SqlSelectResultRow<T extends { Select: Record<string, unknown> }, Args extends SqlSelectArgs<T>> = Simplify<
   SqlTableReadRowSelect<T, Args> & SqlTableReadRowIncludeOne<Args> & SqlTableReadRowIncludeMany<Args>
>;

export function sqlSelect<T extends { Select: Record<string, unknown> }, Args extends SqlSelectArgs<T>>(
   table: SqlTable<T>,
   args: Args,
   info?: SqlQueryInfo | null,
): SqlSelectResult<T, Args> {
   const { includeOne, includeMany } = args;
   ok(!includeMany || Object.keys(includeMany).length === 0, `'includeMany' not supported by default SqlTableRead.`);
   ok(!includeOne || Object.keys(includeOne).length === 0, `'includeOne' not supported by default SqlTableRead.`);

   if (args.JOIN) {
      ok(
         args.JOIN.source.rawStrings[0]?.toLowerCase().includes("join"),
         `'JOIN' criteria not including SQL keyword 'join'`,
      );
   }

   const userWhere = args.WHERE?.source.inline();

   // When user WHERE exists: emit "where <filter> and <userWhere>" — filter uses suffix "and" (only if it has output).
   // When no user WHERE: filter uses prefix "where " so the keyword only appears if filter produces content.
   const filterNode = userWhere
      ? new SqlFilterBy(table, { paramName: "filter", suffix: " and" })
      : new SqlFilterBy(table, { paramName: "filter", prefix: "where " });

   // Projection: runtime column selection. Falls back to all columns when absent.
   const projectionNode = new SqlProjectBy<SqlProjectByParams<T>>(table, "select");
   const projectionGroupByNode = new SqlProjectionGroupBy<SqlProjectByParams<T>>(table, "select");

   // OrderBy: runtime sort. Falls back to compile-time ORDER_BY if provided, otherwise emits nothing.
   const orderByNode = new SqlOrderBy(table, { paramName: "orderBy" });

   // Pagination: runtime limit/offset.
   const paginationNode = new SqlPagination();

   return sql`
         ${info ?? raw.BLANK}
         select
         ${args.SELECT ? args.SELECT.source.inline() : projectionNode}
         from ${table}
         ${args.JOIN ? args.JOIN.source.inline() : raw.BLANK}
         ${userWhere ? sql`where ${filterNode} ${userWhere}`.inline("default") : sql`${filterNode}`.inline("default")}
         ${args.GROUP_BY ? sql`group by ${args.GROUP_BY.source.inline()}`.inline("default") : sql`${projectionGroupByNode}`.inline("default")}
         ${args.HAVING ? sql`having ${args.HAVING.source.inline()}`.inline("default") : raw.BLANK}
         ${args.ORDER_BY ? sql`order by ${args.ORDER_BY.source.inline()}`.inline("default") : orderByNode}
         ${paginationNode}
      ` as unknown as SqlSelectResult<T, Args>;
}

export function expandFromClause<T extends { Select: Record<string, unknown> }>(
   table: SqlTable<T>,
   args: Pick<SqlSelectArgs<T>, "JOIN" | "WHERE" | "GROUP_BY" | "HAVING" | "ORDER_BY">,
) {
   return sql`
      from ${table}
      ${args.JOIN ? args.JOIN.source.inline() : raw.BLANK}
      ${args.WHERE ? sql`where ${args.WHERE.source.inline()}`.inline("default") : raw.BLANK}
      ${args.GROUP_BY ? sql`group by ${args.GROUP_BY.source.inline()}`.inline("default") : raw.BLANK}
      ${args.HAVING ? sql`having ${args.HAVING.source.inline()}`.inline("default") : raw.BLANK}
      ${args.ORDER_BY ? sql`order by ${args.ORDER_BY.source.inline()}`.inline("default") : raw.BLANK}
   `;
}

export type SqlTableReadRowSelect<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs<T>,
> = Args["SELECT"] extends SqlQueryAny ? TypeOf<Args["SELECT"]> : T["Select"];

export type SqlTableReadRowIncludeOne<Args> = Args extends {
   includeOne: Record<string, SqlQueryBaseAny>;
}
   ? {
        [K in keyof Args["includeOne"]]: TypeOf<Args["includeOne"][K]> | null;
     }
   : unknown;

export type SqlTableReadRowIncludeMany<Args> = Args extends {
   includeMany: Record<string, SqlQueryBaseAny>;
}
   ? {
        [K in keyof Args["includeMany"]]: TypeOf<Args["includeMany"][K]>[];
     }
   : unknown;
