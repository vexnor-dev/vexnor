// noinspection SqlNoDataSourceInspection,SqlResolve
import { Sql } from "#src/core/sql-base.js";
import { SqlTable, SqlTableAny } from "#src/core/schema/sql-table.js";
import { ok } from "#src/lib/assert.js";
import { sql } from "#src/core/sql.js";
import { raw } from "#src/core/query/sql-raw.js";
import { row } from "#src/core/query/sql-select-row.js";
import { SqlQueryInfo } from "#src/core/charms/sql-query-info.js";
import { SqlFilterBy } from "#src/core/operators/sql-filter-by.js";
import { SqlJoinBy } from "#src/core/operators/sql-join-by.js";
import { SqlProjectBy, SqlProjectByParams, SqlProjectionGroupBy } from "#src/core/operators/sql-project-by.js";
import { SqlOrderBy } from "#src/core/operators/sql-order-by.js";
import { SqlPagination } from "#src/core/operators/sql-pagination.js";
import { SqlHavingBy } from "#src/core/operators/sql-having-by.js";
import { SqlWindowBy, WindowBySelect } from "#src/core/operators/sql-window-by.js";
import { JoinedTablesDotCols } from "#src/core/operators/sql-join-types.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlBuildError } from "#src/core/sql-build-error.js";
import { SqlPreColumnMap } from "#src/core/crud/sql-pre-column-map.js";
export { SqlPreColumnMap } from "#src/core/crud/sql-pre-column-map.js";
import {
   SqlSelectArgs,
   SqlSelectHooks,
   SqlSelectResult,
} from "#src/core/crud/sql-select.js";

/**
 * Merges root table Select with dot-notation keys from joined tables,
 * producing a combined Select map for use in filter/order/project param types.
 */
type MergedSelect<T extends { Select: Record<string, unknown> }, M extends Record<string, SqlTableAny>> =
   M extends Record<string, never> ? T : { Select: T["Select"] & { [K in JoinedTablesDotCols<M>]?: unknown } };

class SqlSpacedList extends Sql {
   constructor(private readonly items: Sql[]) {
      const hashId = items.map((i) => i.hashId).join("|");
      super({ type: "SqlSpacedList", id: hashId, hashId });
   }
   write(context: SqlBuildContext): void {
      for (const item of this.items) item.build(context);
   }
}

/**
 * Stateful class-based equivalent of the `sqlSelect()` function.
 *
 * Receives `table` and `args` in the constructor, exposes protected factory methods
 * as override points for plugins, and composes the final SQL via `build()`.
 *
 * Token emission order is identical to `sqlSelect()` for serialization compatibility.
 */
export class SqlSelectCommand<
   T extends { Select: Record<string, unknown> },
   Args extends SqlSelectArgs<T>,
   M extends Record<string, SqlTableAny> = Record<string, never>,
> {
   protected readonly table: SqlTable<T>;
   protected readonly args: Args;
   protected readonly info: SqlQueryInfo | null;
   protected readonly joinMap: M | undefined;
   protected readonly joinTypes: Record<string, string> | undefined;
   protected readonly hooks: SqlSelectHooks | undefined;

   /** Computed dot-notation field names from joined tables */
   protected readonly joinedFieldNames: string[];
   /** All field names: root table + joined */
   protected readonly allFieldNames: string[];
   /** Registry of join keys → "schema.table" for conflict detection */
   protected readonly joinKeyRegistry: Map<string, string>;
   /** Tables extracted from compile-time JOIN arg */
   protected readonly joinArgTables: Record<string, SqlTableAny>;
   /** Joined tables from joinMap */
   protected readonly joinedTables: SqlTableAny[];

   constructor(
      table: SqlTable<T>,
      args: Args,
      info?: SqlQueryInfo | null,
      joinMap?: M,
      joinTypes?: Record<string, string>,
      hooks?: SqlSelectHooks,
   ) {
      this.table = table;
      this.args = args;
      this.info = info ?? null;
      this.joinMap = joinMap;
      this.joinTypes = joinTypes;
      this.hooks = hooks;

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
      this.joinedFieldNames = [];
      this.joinedTables = joinMap ? Object.values(joinMap) : [];
      this.joinKeyRegistry = new Map<string, string>();

      if (joinMap) {
         for (const [alias, jt] of Object.entries(joinMap)) {
            const jtAny = jt as SqlTableAny;
            this.joinKeyRegistry.set(alias, `${jtAny.tableInfo.schema}.${jtAny.tableInfo.name}`);
            for (const key of jtAny.colKeys) {
               this.joinedFieldNames.push(`${alias}.${key}`);
            }
         }
      }

      // Extract tables from compile-time JOIN arg
      this.joinArgTables = {};
      if (args.JOIN) {
         for (const rawValue of args.JOIN.source.rawValues) {
            if (rawValue instanceof SqlTable) {
               const name = rawValue.tableInfo.name;
               const fqn = `${rawValue.tableInfo.schema}.${name}`;
               if (this.joinKeyRegistry.has(name)) {
                  const existing = [...this.joinKeyRegistry.entries()].map(([k, v]) => `${k}:${v}`).join(", ");
                  throw new SqlBuildError(
                     `[select] JOIN table "${name}" (${fqn}) conflicts with existing join key. Registered: ${existing}`,
                  );
               }
               this.joinKeyRegistry.set(name, fqn);
               this.joinArgTables[name] = rawValue;
               for (const key of rawValue.colKeys) {
                  this.joinedFieldNames.push(`${name}.${key}`);
               }
            }
         }
      }

      this.allFieldNames = [...(table as SqlTable<T>).colKeys, ...this.joinedFieldNames];
   }

   /**
    * Creates the projection node (runtime column selection).
    * Falls back to all columns when absent.
    */
   protected createProjectionNode(fieldNames: string[]): Sql {
      return new SqlProjectBy<SqlProjectByParams<T>>(this.table as SqlTableAny, "select", fieldNames);
   }

   /**
    * Creates the filter node (WHERE filterBy).
    * When user WHERE exists: suffix mode. Otherwise: prefix mode.
    */
   protected createFilterNode(fieldNames: string[], options: { prefix?: string; suffix?: string }): Sql {
      return new SqlFilterBy(this.table as SqlTableAny, { paramName: "filterBy", ...options, fieldNames });
   }

   /**
    * Creates the ORDER BY node (runtime sort).
    */
   protected createOrderByNode(fieldNames: string[]): Sql {
      return new SqlOrderBy(this.table as SqlTableAny, { paramName: "orderBy", fieldNames, selectParamName: "select" });
   }

   /**
    * Creates the HAVING node (runtime HAVING filter on aggregate aliases).
    */
   protected createHavingNode(): Sql {
      return new SqlHavingBy(this.table as SqlTableAny, "havingBy", "select");
   }

   /**
    * Creates the window function node (runtime window functions appended to SELECT list).
    */
   protected createWindowByNode(fieldNames: string[]): Sql {
      return new SqlWindowBy<MergedSelect<T, M>>(
         this.table as SqlTableAny,
         "windowBy",
         fieldNames,
         this.args.windowBy as WindowBySelect | undefined,
      );
   }

   /**
    * Creates the pagination node (runtime LIMIT/OFFSET).
    */
   protected createPaginationNode(): Sql {
      return new SqlPagination();
   }

   /**
    * Creates the JOIN BY node (runtime table joins).
    * Only for joined queries (SqlTableJoin.select()).
    */
   protected createJoinByNode(joinTypes?: Record<string, string>, joinMap?: Record<string, SqlTableAny>): Sql {
      const hasJoinMap = this.joinedTables.length > 0;
      if (hasJoinMap) {
         return new SqlJoinBy(
            this.table as SqlTableAny,
            "joinBy",
            joinTypes,
            joinMap as Record<string, SqlTableAny>,
         );
      }
      return raw.BLANK;
   }

   /**
    * Creates the GROUP BY node (projection-based grouping).
    */
   protected createGroupByNode(): Sql {
      return new SqlProjectionGroupBy<SqlProjectByParams<T>>(this.table as SqlTableAny, "select");
   }

   /**
    * Creates include fragments for includeOne/includeMany.
    * Returns null by default — plugins override this to provide lateral join support.
    */
   protected createIncludes(): { afterSelect: Sql[]; afterFrom: Sql[] } | null {
      return null;
   }

   /**
    * Composes the final SQL template exactly as the `sqlSelect()` function does.
    * Preserves the exact same token emission order for serialization compatibility.
    */
   build(): SqlSelectResult<T, Args, M> {
      const { args, table, info, hooks } = this;

      const userWhere = args.WHERE?.source.inline();

      // When user WHERE exists: emit "where <filter> and <userWhere>" — filter uses suffix "and" (only if it has output).
      // When no user WHERE: filter uses prefix "where " so the keyword only appears if filter produces content.
      const filterNode = userWhere
         ? this.createFilterNode(this.allFieldNames, { suffix: " and" })
         : this.createFilterNode(this.allFieldNames, { prefix: "where " });

      // Projection: runtime column selection. Falls back to all columns when absent.
      const projectionNode = this.createProjectionNode(this.allFieldNames);
      const projectionGroupByNode = this.createGroupByNode();

      // OrderBy: runtime sort. Falls back to compile-time ORDER_BY if provided, otherwise emits nothing.
      const orderByNode = this.createOrderByNode(this.allFieldNames);

      // HavingBy: runtime HAVING filter on aggregate aliases.
      const havingByNode = this.createHavingNode();

      // WindowBy: runtime window functions appended to SELECT list.
      const windowByNode = this.createWindowByNode(this.allFieldNames);

      // Pagination: runtime limit/offset.
      const paginationNode = this.createPaginationNode();

      // JoinBy: runtime table joins — only for joined queries (SqlTableJoin.select()).
      const joinByNode = this.createJoinByNode(this.joinTypes, this.joinMap as Record<string, SqlTableAny>);

      // Pre-populate columnMap so projection/filter/orderBy can resolve dot-notation keys
      // before the joinBy node emits its SQL (which comes after FROM in the template).
      const preColumnMap =
         this.joinedTables.length || Object.keys(this.joinArgTables).length
            ? new SqlPreColumnMap(table as SqlTableAny, this.joinMap as Record<string, SqlTableAny>, this.joinArgTables, this.joinKeyRegistry)
            : new SqlPreColumnMap(table as SqlTableAny, null, this.joinArgTables, this.joinKeyRegistry);

      // Resolve includes from hooks or createIncludes()
      const effectiveHooks = hooks ?? {};
      const includes = this.createIncludes();
      const afterSelect = effectiveHooks.afterSelect ?? includes?.afterSelect;
      const afterFrom = effectiveHooks.afterFrom ?? includes?.afterFrom;

      return sql`
      ${info ?? raw.BLANK}
      ${preColumnMap}
      select ${args.SELECT ? args.SELECT.source.inline("default") : (afterSelect?.length ? row((table as SqlTableAny).$$) : projectionNode)} ${windowByNode}
                ${afterSelect?.length ? raw(", ") : raw.BLANK} ${afterSelect ?? raw.BLANK}
      from ${table} ${afterFrom?.length ? new SqlSpacedList(afterFrom) : raw.BLANK} ${args.JOIN ? args.JOIN.source.inline() : raw.BLANK} ${joinByNode}
         ${userWhere ? sql`where ${filterNode} ${userWhere}`.inline("default") : sql`${filterNode}`.inline("default")}
         ${args.GROUP_BY ? sql`group by ${args.GROUP_BY.source.inline()}`.inline("default") : sql`${projectionGroupByNode}`.inline("default")}
         ${args.HAVING ? sql`having ${args.HAVING.source.inline()}`.inline("default") : sql`${havingByNode}`.inline("default")}
         ${args.ORDER_BY ? sql`order by ${args.ORDER_BY.source.inline()}`.inline("default") : orderByNode}
         ${effectiveHooks.pagination ?? paginationNode}
   ` as unknown as SqlSelectResult<T, Args, M>;
   }
}
