// noinspection SqlNoDataSourceInspection,SqlResolve
import { SqlQueryAny, SqlQueryBaseAny, SqlQueryExtended } from "#src/core/query/sql-query.js";
import { SqlParam } from "#src/core/query/sql-param.js";
import { Simplify } from "#src/core/utils/utility-types.js";
import { ParamsOfArgs, Sql, TypeOf } from "#src/core/sql-base.js";
import { SqlTable, SqlTableAny } from "#src/core/schema/sql-table.js";
import { ok } from "#src/lib/assert.js";
import { sql } from "#src/core/sql.js";
import { raw } from "#src/core/query/sql-raw.js";
import { SqlQueryInfo } from "#src/core/charms/sql-query-info.js";
import { SqlFilterBy, SqlFilterParams } from "#src/core/operators/sql-filter-by.js";
import { SqlJoinBy } from "#src/core/operators/sql-join-by.js";
import { SqlProjectBy, SqlProjectByParams, SqlProjectionGroupBy } from "#src/core/operators/sql-project-by.js";
import { SqlOrderBy, SqlOrderByParams } from "#src/core/operators/sql-order-by.js";
import { SqlPagination, SqlPaginationParams } from "#src/core/operators/sql-pagination.js";
import { SqlHavingBy, SqlHavingByParams } from "#src/core/operators/sql-having-by.js";
import { SqlWindowBy, SqlWindowByParams } from "#src/core/operators/sql-window-by.js";
import { JoinByMap, JoinedTablesDotCols } from "#src/core/operators/sql-join-types.js";
import { SqlTableColumnAny } from "#src/core/schema/sql-table-column.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlBuildError } from "#src/core/sql-build-error.js";

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
export type SqlSelectArgs<
   T extends { Select: Record<string, unknown> },
> = {
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

/**
 * Merges root table Select with dot-notation keys from joined tables,
 * producing a combined Select map for use in filter/order/project param types.
 */
type MergedSelect<
   T extends { Select: Record<string, unknown> },
   M extends Record<string, SqlTableAny>,
> = M extends Record<string, never>
   ? T
   : { Select: T["Select"] & { [K in JoinedTablesDotCols<M>]?: unknown } };

export type SqlSelectResult<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs<T>,
   M extends Record<string, SqlTableAny> = Record<string, never>,
> = SqlQueryExtended<{
   Row: SqlSelectResultRow<T, Args>;
   Params: (ParamsOfArgs<Args> extends void ? unknown : ParamsOfArgs<Args>)
      & SqlFilterParams<MergedSelect<T, M>, "filterBy">
      & (M extends Record<string, never> ? unknown : { joinBy?: JoinByMap<Extract<keyof T["Select"], string>, M> | null })
      & SqlOrderByParams<MergedSelect<T, M>, "orderBy">
      & SqlPaginationParams
      & SqlProjectByParams<MergedSelect<T, M>>
      & SqlHavingByParams
      & SqlWindowByParams;
}>;

export type SqlSelectResultRow<T extends { Select: Record<string, unknown> }, Args extends SqlSelectArgs<T>> = Simplify<
   SqlTableReadRowSelect<T, Args> & SqlTableReadRowIncludeOne<Args> & SqlTableReadRowIncludeMany<Args>
>;

export type SqlSelectHooks = {
   afterSelect?: Sql[];
   afterFrom?: Sql[];
   pagination?: Sql;
};

class SqlSpacedList extends Sql {
   constructor(private readonly items: Sql[]) {
      const hashId = items.map((i) => i.hashId).join("|");
      super({ type: "SqlSpacedList", id: hashId, hashId });
   }
   write(context: SqlBuildContext): void {
      for (const item of this.items) item.build(context);
   }
}

export function sqlSelect<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs<T>,
   M extends Record<string, SqlTableAny> = Record<string, never>,
>(
   table: SqlTable<T>,
   args: Args,
   info?: SqlQueryInfo | null,
   joinMap?: M,
   joinTypes?: Record<string, string>,
   hooks?: SqlSelectHooks,
): SqlSelectResult<T, Args, M> {
   const { includeOne, includeMany } = args;
   if (!hooks) {
      ok(!includeMany || Object.keys(includeMany).length === 0, `'includeMany' not supported without hooks.`);
      ok(!includeOne || Object.keys(includeOne).length === 0, `'includeOne' not supported without hooks.`);
   }

   if (args.JOIN) {
      ok(
         args.JOIN.source.rawStrings[0]?.toLowerCase().includes("join"),
         `'JOIN' criteria not including SQL keyword 'join'`,
      );
   }

   // Compute dot-notation fieldNames from joined tables
   const joinedFieldNames: string[] = [];
   const joinedTables = joinMap ? Object.values(joinMap) : [];
   const joinKeyRegistry = new Map<string, string>(); // key → "schema.table" for conflict detection

   if (joinMap) {
      for (const [alias, jt] of Object.entries(joinMap)) {
         const jtAny = jt as SqlTableAny;
         joinKeyRegistry.set(alias, `${jtAny.tableInfo.schema}.${jtAny.tableInfo.name}`);
         for (const key of jtAny.colKeys) {
            joinedFieldNames.push(`${alias}.${key}`);
         }
      }
   }

   // Extract tables from compile-time JOIN arg
   const joinArgTables: Record<string, SqlTableAny> = {};
   if (args.JOIN) {
      for (const rawValue of args.JOIN.source.rawValues) {
         if (rawValue instanceof SqlTable) {
            const name = rawValue.tableInfo.name;
            const fqn = `${rawValue.tableInfo.schema}.${name}`;
            if (joinKeyRegistry.has(name)) {
               const existing = [...joinKeyRegistry.entries()].map(([k, v]) => `${k}:${v}`).join(", ");
               throw new SqlBuildError(`[select] JOIN table "${name}" (${fqn}) conflicts with existing join key. Registered: ${existing}`);
            }
            joinKeyRegistry.set(name, fqn);
            joinArgTables[name] = rawValue;
            for (const key of rawValue.colKeys) {
               joinedFieldNames.push(`${name}.${key}`);
            }
         }
      }
   }

   const allFieldNames = [...table.colKeys, ...joinedFieldNames];

   const userWhere = args.WHERE?.source.inline();

   // When user WHERE exists: emit "where <filter> and <userWhere>" — filter uses suffix "and" (only if it has output).
   // When no user WHERE: filter uses prefix "where " so the keyword only appears if filter produces content.
   const filterNode = userWhere
      ? new SqlFilterBy(table, { paramName: "filterBy", suffix: " and", fieldNames: allFieldNames })
      : new SqlFilterBy(table, { paramName: "filterBy", prefix: "where ", fieldNames: allFieldNames });

   // Projection: runtime column selection. Falls back to all columns when absent.
   const projectionNode = new SqlProjectBy<SqlProjectByParams<T>>(table, "select", allFieldNames);
   const projectionGroupByNode = new SqlProjectionGroupBy<SqlProjectByParams<T>>(table, "select");

   // OrderBy: runtime sort. Falls back to compile-time ORDER_BY if provided, otherwise emits nothing.
   const orderByNode = new SqlOrderBy(table, { paramName: "orderBy", fieldNames: allFieldNames });

   // HavingBy: runtime HAVING filter on aggregate aliases.
   const havingByNode = new SqlHavingBy(table, "havingBy", "select");

   // WindowBy: runtime window functions appended to SELECT list.
   const windowByNode = new SqlWindowBy(table, "windowBy", allFieldNames);

   // Pagination: runtime limit/offset.
   const paginationNode = new SqlPagination();

   // JoinBy: runtime table joins — only for joined queries (SqlTableJoin.select()).
   const hasJoinMap = joinedTables.length > 0;
   const joinByNode = hasJoinMap ? new SqlJoinBy(table, "joinBy", joinTypes, joinMap as Record<string, SqlTableAny>) : raw.BLANK;

   // Pre-populate columnMap so projection/filter/orderBy can resolve dot-notation keys
   // before the joinBy node emits its SQL (which comes after FROM in the template).
   const preColumnMap = joinedTables.length || Object.keys(joinArgTables).length
      ? new SqlPreColumnMap(table, joinMap as Record<string, SqlTableAny>, joinArgTables, joinKeyRegistry)
      : new SqlPreColumnMap(table, null, joinArgTables, joinKeyRegistry);

   return sql`
      ${info ?? raw.BLANK}
      ${preColumnMap}
      select ${args.SELECT ? args.SELECT.source.inline() : projectionNode} ${windowByNode}
                ${hooks?.afterSelect?.length ? raw(", ") : raw.BLANK} ${hooks?.afterSelect ?? raw.BLANK}
      from ${table} ${hooks?.afterFrom?.length ? new SqlSpacedList(hooks.afterFrom) : raw.BLANK} ${args.JOIN ? args.JOIN.source.inline() : raw.BLANK} ${joinByNode}
         ${userWhere ? sql`where ${filterNode} ${userWhere}`.inline("default") : sql`${filterNode}`.inline("default")}
         ${args.GROUP_BY ? sql`group by ${args.GROUP_BY.source.inline()}`.inline("default") : sql`${projectionGroupByNode}`.inline("default")}
         ${args.HAVING ? sql`having ${args.HAVING.source.inline()}`.inline("default") : sql`${havingByNode}`.inline("default")}
         ${args.ORDER_BY ? sql`order by ${args.ORDER_BY.source.inline()}`.inline("default") : orderByNode}
         ${hooks?.pagination ?? paginationNode}
   ` as unknown as SqlSelectResult<T, Args, M>;
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

/**
 * Emits no SQL text but pre-populates context.columnMap with dot-notation keys
 * from joined tables so that projection/filter/orderBy can resolve them
 * before the joinBy node runs.
 */
class SqlPreColumnMap extends Sql {
   constructor(
      private readonly rootTable: SqlTableAny,
      private readonly joinMap: Record<string, SqlTableAny> | null,
      private readonly joinArgTables: Record<string, SqlTableAny>,
      private readonly joinKeyRegistry: Map<string, string>,
   ) {
      super({ type: "SqlPreColumnMap", id: "preColumnMap", hashId: "preColumnMap" });
   }

   write(context: SqlBuildContext): void {
      if (!context.params) return;

      // Only activate when there are actual joins to resolve
      const params = context.params as Record<string, unknown>;
      const hasJoinMap = this.joinMap && Object.keys(this.joinMap).length > 0;
      const hasJoinArgTables = Object.keys(this.joinArgTables).length > 0;
      const hasJoinByParam = !this.joinMap && params["joinBy"] != null;
      if (!hasJoinMap && !hasJoinArgTables && !hasJoinByParam) return;

      for (const [key, col] of Object.entries(this.rootTable.cols)) {
         const column = col as SqlTableColumnAny;
         const colKey = key.slice(1);
         context.addColumns({
            [colKey]: column, [`${this.rootTable.tableInfo.name}.${colKey}`]: column});
      }

      if (this.joinMap) {
         for (const [alias, jt] of Object.entries(this.joinMap)) {
            for (const [key, col] of Object.entries(jt.cols)) {
               const column = col as SqlTableColumnAny;
               const colKey = key.slice(1);
               context.addColumns({[`${alias}.${colKey}`]: column, [colKey]: column});
            }
         }
      }

      // Populate columns from compile-time JOIN arg tables
      for (const [alias, jt] of Object.entries(this.joinArgTables)) {
         for (const [key, col] of Object.entries(jt.cols)) {
            const column = col as SqlTableColumnAny;
            const colKey = key.slice(1);
            context.addColumns({ [`${alias}.${colKey}`]: column, [colKey]: column });
         }
      }

      // Populate columns from runtime joinBy param (with conflict detection)
      if (!this.joinMap) {
         const joinByParam = params["joinBy"];
         if (joinByParam && typeof joinByParam === "object") {
            const tableNames: string[] = Array.isArray(joinByParam)
               ? (joinByParam as { table: string }[]).map((e) => e.table)
               : Object.keys(joinByParam as Record<string, unknown>);
            for (const alias of tableNames) {
               if (this.joinKeyRegistry.has(alias)) {
                  const existing = [...this.joinKeyRegistry.entries()].map(([k, v]) => `${k}:${v}`).join(", ");
                  throw new SqlBuildError(`[joinBy] Table "${alias}" conflicts with existing join key. Registered: ${existing}`);
               }
               const jt = SqlTable.resolve({
                  source: this.rootTable.source,
                  schema: this.rootTable.tableInfo.schema ?? "public",
                  table: alias,
               });
               if (!jt) continue;
               for (const [key, col] of Object.entries(jt.cols)) {
                  const column = col as SqlTableColumnAny;
                  const colKey = key.slice(1);
                  context.addColumns({ [`${alias}.${colKey}`]: column, [colKey]: column});
               }
            }
         }
      }
   }
}
