import { SqlQueryAny, SqlQueryExtended } from "#/core/query/sql-query.js";
import { SqlParam } from "#/core/query/sql-param.js";
import { Simplify } from "#/core/utils/utility-types.js";
import { ParamsOfArgs, RowOf, TypeOf } from "#/core/sql-base.js";
import { SqlTable } from "#/core/schema/sql-table.js";
import { ok } from "assert";
import { strictEqual } from "node:assert";
import { sql } from "#/core/sql.js";
import { raw } from "#/core/query/sql-raw.js";
import { SqlQueryInfo } from "#/core/charms/sql-query-info.js";
import { row } from "#/core/query/sql-select-row.js";

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
> = Args["SELECT"] extends SqlQueryAny ? RowOf<Args["SELECT"]> : T["Select"];

export type SqlTableReadRowIncludeOne<Args> = Args extends {
   includeOne: Record<string, SqlQueryAny>;
}
   ? {
        [K in keyof Args["includeOne"]]: TypeOf<Args["includeOne"][K]>;
     }
   : unknown;

export type SqlTableReadRowIncludeMany<Args> = Args extends {
   includeMany: Record<string, SqlQueryAny>;
}
   ? {
        [K in keyof Args["includeMany"]]: TypeOf<Args["includeMany"][K]>[];
     }
   : unknown;
