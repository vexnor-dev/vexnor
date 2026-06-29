import { PARAMS, Sql, SqlOptions } from "#src/core/sql-base.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { BuildSqlParams, PathToNested, SqlParam } from "#src/core/query/sql-param.js";
import { SqlTable, SqlTableAny } from "#src/core/schema/sql-table.js";
import { SqlTableColumnAny } from "#src/core/schema/sql-table-column.js";
import { JoinOperator } from "#src/core/operators/sql-join-types.js";
import { SqlBuildError } from "#src/core/sql-build-error.js";

/**
 * Runtime shape of a single join condition (3-tuple after normalization).
 */
export type JoinByCondition = [left: string, op: JoinOperator, right: string];

/**
 * Internal normalized entry for a single table join.
 */
export type JoinByEntry = {
   table: string;
   on: JoinByCondition[];
   type?: string;
};

/**
 * Runtime joinBy param — object keyed by alias, each value is { on: conditions[], type?: JoinType }.
 */
export type JoinByParam = Record<string, { on: JoinByCondition[]; type?: string } | null | undefined>;

export type SqlJoinByParams<ParamName extends string> = PathToNested<
   ParamName,
   JoinByParam
>;

function normalizeJoinByParam(param: unknown): JoinByEntry[] {
   if (!param || typeof param !== "object" || Array.isArray(param)) return [];

   const entries: JoinByEntry[] = [];
   for (const [table, value] of Object.entries(param as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const { on, type } = value as { on?: unknown[]; type?: string };
      if (!on || !Array.isArray(on)) continue;
      entries.push({ table, on: on as JoinByCondition[], type });
   }
   return entries;
}

/**
 * Runtime JOIN operator for CRUD select().
 * Resolves table names to SqlTable instances and emits JOIN clauses.
 * Populates context.columnMap so filterBy/orderBy/projectBy can resolve
 * table-qualified column names (e.g. "City.city", "Payment.amount").
 *
 * @example
 * params: {
 *   joinBy: [
 *     { table: "rental", on: ["rentalId"] },
 *     { table: "customer", on: ["customerId"] },
 *     { table: "address", on: ["addressId"] },
 *     { table: "city", on: ["cityId"], type: "left" },
 *   ],
 *   filterBy: [{ "City.city": "London" }],
 *   orderBy: { amount: "DESC" },
 *   limit: 5
 * }
 */
export class SqlJoinBy<ParamName extends string = "joinBy"> extends Sql {
   declare readonly [PARAMS]: SqlJoinByParams<ParamName>;

   readonly table: SqlTableAny;
   readonly paramName: ParamName;
   readonly joinTypes: Record<string, string>;
   readonly params: BuildSqlParams<unknown>;

   constructor(table: SqlTableAny, paramName: ParamName, joinTypes?: Record<string, string>) {
      super({
         type: "SqlJoinBy",
         id: `${table.tableInfo.name}.${paramName}`,
         hashId: `${table.hashId}|joinBy:${paramName}`,
      } satisfies SqlOptions);

      this.table = table;
      this.paramName = paramName;
      this.joinTypes = joinTypes ?? {};
      this.params = {
         [paramName]: new SqlParam({
            name: paramName,
            isContext: false,
         }),
      } as BuildSqlParams<unknown>;
   }

   write(context: SqlBuildContext): void {
      if (!context.params) {
         context.addOperator({ type: "joinBy", param: this.paramName });
         return;
      }

      const params = context.params as Record<string, unknown>;
      const rawParam = params[this.paramName];
      const entries = normalizeJoinByParam(rawParam);
      if (!entries.length) return;

      // Track resolved tables by alias for column lookup
      const rootName = this.table.tableInfo.name;
      const tablesByAlias: Record<string, SqlTableAny> = { _: this.table, [rootName]: this.table };

      // Process each join entry
      for (const entry of entries) {
         const joinedTable = this.resolveTable(entry.table);
         if (!joinedTable) {
            throw new SqlBuildError(`[joinBy] Table "${entry.table}" not found in registry`);
         }

         const joinType = (entry.type ?? this.joinTypes[entry.table] ?? "inner").toUpperCase();
         const keyword = joinType === "INNER" ? "JOIN" : `${joinType} JOIN`;

         context.addStrings(` ${keyword} `);
         joinedTable.write(context);
         tablesByAlias[entry.table] = joinedTable;

         if (joinType !== "CROSS") {
            context.addStrings(" ON ");
            let first = true;
            for (const [left, op, right] of entry.on) {
               if (!first) context.addStrings(" AND ");
               first = false;

               const leftCol = this.resolveColRef(left, tablesByAlias);
               const rightCol = this.resolveColRef(right, tablesByAlias);
               if (!leftCol || !rightCol) {
                  throw new SqlBuildError(`[joinBy] Cannot resolve ON condition: ${left} ${op} ${right}`);
               }
               leftCol.build(context);
               context.addStrings(` ${op} `);
               rightCol.build(context);
            }
         }

         // Register joined table columns in context
         for (const [key, col] of Object.entries(joinedTable.cols)) {
            const column = col as SqlTableColumnAny;
            const colKey = key.slice(1);
            context.addColumns({ [`${entry.table}.${colKey}`]: column });
            if (!context.getColumn(colKey)) {
               context.addColumns({ [colKey]: column });
            }
         }
      }
   }

   /**
    * Resolves a "prefix.col" reference to a SqlTableColumnAny.
    * Prefix is "_" for root table, or an alias name for joined tables.
    */
   private resolveColRef(ref: string, tablesByAlias: Record<string, SqlTableAny>): SqlTableColumnAny | undefined {
      const dot = ref.indexOf(".");
      if (dot === -1) {
         // Bare column name — search all tables (root first, then joined in order)
         for (const table of Object.values(tablesByAlias)) {
            const col = (table.cols as Record<string, SqlTableColumnAny>)[`$${ref}`];
            if (col) return col;
         }
         return undefined;
      }
      const alias = ref.slice(0, dot);
      const colKey = ref.slice(dot + 1);
      const table = tablesByAlias[alias];
      if (!table) return undefined;
      return (table.cols as Record<string, SqlTableColumnAny>)[`$${colKey}`];
   }

   private resolveTable(name: string): SqlTableAny | undefined {
      const dot = name.indexOf(".");
      const schema = dot !== -1 ? name.slice(0, dot) : (this.table.tableInfo.schema ?? "public");
      const table = dot !== -1 ? name.slice(dot + 1) : name;
      return SqlTable.resolve({
         source: this.table.source,
         schema,
         table,
      });
   }
}

/**
 * Creates a joinBy operator for runtime JOIN resolution.
 */
export function joinBy<ParamName extends string = "joinBy">(
   table: SqlTableAny,
   paramName?: ParamName,
): SqlJoinBy<ParamName> {
   return new SqlJoinBy(table, paramName ?? ("joinBy" as ParamName));
}
