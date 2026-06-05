import { sql, raw, row, SqlTable, sqlSelect, SqlSelectArgs, ParamsOfArgs, SqlQueryExtended, SqlSelectResultRow } from "#/core/core.js";

/**
 * Test-only drop-in for plugin selects (postgresSelect, sqlite3Select, mssqlSelect).
 *
 * Accepts the full `SqlSelectArgs` including `includeOne` and `includeMany` without
 * the runtime guard present in `sqlSelect`. Used to test param and row type propagation
 * through `SqlSelectResultRow<T, Args>` and `ParamsOfArgs<Args>` within the base package.
 */
export function testSelect<T extends { Select: Record<string, unknown> }, Args extends SqlSelectArgs>(
   table: SqlTable<T>,
   args: Args,
): SqlQueryExtended<{ Row: SqlSelectResultRow<T, Args>; Params: ParamsOfArgs<Args> }> {
   const { includeOne, includeMany, ...baseArgs } = args;

   const includeFragments = [
      ...Object.entries(includeOne ?? {}).map(([k]) => sql`(select 1) as ${raw(`"${k}"`)}`) ,
      ...Object.entries(includeMany ?? {}).map(([k]) => sql`(select '[]') as ${raw(`"${k}"`)}`) ,
   ];

   const baseQuery = sqlSelect(table as SqlTable<{ Select: Record<string, unknown> }>, baseArgs as SqlSelectArgs);

   if (!includeFragments.length) {
      return baseQuery as unknown as SqlQueryExtended<{ Row: SqlSelectResultRow<T, Args>; Params: ParamsOfArgs<Args> }>;
   }

   return sql`
      select ${baseArgs.SELECT ? baseArgs.SELECT.inline() : row(table.$$)}
         ${includeFragments.length > 0 ? raw(", ") : raw.BLANK} ${includeFragments}
      from ${table}
      ${baseArgs.WHERE ? sql`where ${baseArgs.WHERE.inline()}`.inline("default") : raw.BLANK}
      ${baseArgs.ORDER_BY ? sql`order by ${baseArgs.ORDER_BY.inline()}`.inline("default") : raw.BLANK}
   ` as unknown as SqlQueryExtended<{ Row: SqlSelectResultRow<T, Args>; Params: ParamsOfArgs<Args> }>;
}
