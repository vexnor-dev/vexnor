import { PARAMS, Sql, SqlOptions } from "#src/core/sql-base.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlTableAny } from "#src/core/schema/sql-table.js";
import { SqlTableColumnAny } from "#src/core/schema/sql-table-column.js";
import { BuildSqlParams, PathToNested, SqlParam } from "#src/core/query/sql-param.js";
import { isPrimitive } from "#src/lib/primitive.js";
import { SqlBuildError } from "#src/core/sql-build-error.js";
import { resolvePath } from "#src/core/query/resolve-path.js";
import { SqlProjectByEntryValue, SqlProjectByFnEntry, sqlProjectByAggregations } from "#src/core/operators/sql-project-by.js";
import { FilterOperator, filterOperators } from "#src/core/operators/sql-filter-by.js";

/**
 * A single HAVING condition: `{ alias: value | [op, ...args] }`.
 * Aliases must match aggregate aliases from the select param.
 */
export type HavingCondition<Aliases extends string = string> = { [K in Aliases]?: unknown | [FilterOperator, ...unknown[]] };

/**
 * An array of HAVING conditions — entries are AND'd together.
 */
export type HavingConditionList<Aliases extends string = string> = HavingCondition<Aliases>[];

export type SqlHavingByParams<Aliases extends string = string, ParamName extends string = "havingBy"> = PathToNested<
   ParamName,
   HavingConditionList<Aliases> | null | undefined
>;

/**
 * Portable HAVING operator. Filters on aggregate aliases defined in the `select` param.
 * Resolves each alias back to its aggregate expression (e.g., count("col")) and emits
 * `fn(col) op value` conditions.
 *
 * @example
 * params: {
 *   select: { title: "film.title", rental_count: { fn: "count", col: "rental.rentalId" } },
 *   havingBy: [{ rental_count: [">", 10] }]
 * }
 * // → HAVING count("rental_id") > $1
 */
export class SqlHavingBy<ParamName extends string = "havingBy"> extends Sql {
   declare readonly [PARAMS]: SqlHavingByParams<ParamName>;

   readonly table: SqlTableAny;
   readonly paramName: ParamName;
   readonly selectParamName: string;
   readonly params: BuildSqlParams<SqlHavingByParams<ParamName>>;

   get aiPrompt() {
      return `havingBy: [{alias: value}] or [{alias: ["op", ...args]}]. Filter on aggregate aliases from select. Ops: =, !=, >, >=, <, <=, between, in, notIn. Alias must match a key in select that has an aggregate fn.`;
   }

   constructor(table: SqlTableAny, paramName: ParamName, selectParamName: string) {
      super({
         type: "SqlHavingBy",
         id: `${table.tableInfo.name}.${paramName}`,
         hashId: `${table.hashId}|${paramName}`,
      } satisfies SqlOptions);

      this.table = table;
      this.paramName = paramName;
      this.selectParamName = selectParamName;

      this.params = {
         [paramName]: new SqlParam({
            name: paramName,
            isContext: false,
         }),
      } as BuildSqlParams<SqlHavingByParams<ParamName>>;
   }

   write(context: SqlBuildContext): void {
      if (!context.params) {
         context.addOperator({ type: "havingBy", param: this.paramName });
         return;
      }

      const conditions = resolvePath(context.params as Record<string, unknown>, this.paramName) as HavingConditionList | null | undefined;
      if (!conditions || !conditions.length) return;

      // Resolve aggregate aliases from the select param
      const selectObj = resolvePath(context.params as Record<string, unknown>, this.selectParamName) as Record<string, SqlProjectByEntryValue> | null | undefined;
      const aggregateMap = new Map<string, SqlProjectByFnEntry>();
      if (selectObj && typeof selectObj === "object") {
         for (const [alias, value] of Object.entries(selectObj)) {
            if (typeof value === "object" && value !== null && "fn" in value) {
               const entry = value as SqlProjectByFnEntry;
               if (sqlProjectByAggregations.has(entry.fn)) {
                  aggregateMap.set(alias, entry);
               }
            }
         }
      }

      if (aggregateMap.size === 0) {
         throw new SqlBuildError(`havingBy requires aggregate columns in the select param`);
      }

      context.addStrings("having ");

      let emitted = 0;
      for (const condition of conditions) {
         for (const [alias, value] of Object.entries(condition)) {
            if (value === undefined) continue;
            const agg = aggregateMap.get(alias);
            if (!agg) throw new SqlBuildError(`havingBy: alias '${alias}' not found in select aggregates. Available: ${[...aggregateMap.keys()].join(", ")}`);
            if (!sqlProjectByAggregations.has(agg.fn)) throw new SqlBuildError(`Invalid aggregate function: ${agg.fn}`);

            if (emitted > 0) context.addStrings(" and ");
            this.writeAggregate(context, agg);

            if (Array.isArray(value)) {
               const [op, ...args] = value as [string, ...unknown[]];
               if (!filterOperators.has(op)) throw new SqlBuildError(`Invalid havingBy operator: ${op}`);
               this.writeOp(context, op as FilterOperator, args);
            } else {
               if (!isPrimitive(value)) throw new SqlBuildError(`havingBy value is not a primitive: ${String(value)}`);
               context.addStrings(" = ");
               context.addValues(value);
            }
            emitted++;
         }
      }
   }

   private writeAggregate(context: SqlBuildContext, agg: SqlProjectByFnEntry): void {
      context.addStrings(`${agg.fn}(`);
      if (agg.col === "*") {
         context.addStrings("*");
      } else {
         if (context.columnCount > 0) {
            const col = context.getColumn(agg.col) ?? context.getColumn(agg.col.split(".").pop()!);
            if (!col) throw new SqlBuildError(`Column not found in havingBy aggregate: ${agg.col}`);
            col.render("tableAlias.columnName").build(context);
         } else {
            const col = this.table.cols[`$${agg.col}` as `$${string}`] as SqlTableColumnAny | undefined;
            if (col) {
               col.render("tableAlias.columnName").build(context);
            } else {
               // Try stripping table prefix
               const dot = agg.col.indexOf(".");
               const colKey = dot !== -1 ? agg.col.slice(dot + 1) : agg.col;
               const stripped = this.table.cols[`$${colKey}` as `$${string}`] as SqlTableColumnAny | undefined;
               if (stripped) {
                  stripped.render("tableAlias.columnName").build(context);
               } else {
                  // Fallback: emit quoted identifier
                  const escaped = agg.col.replace(/"/g, '""');
                  context.addStrings(`"${escaped}"`);
               }
            }
         }
      }
      context.addStrings(")");
   }

   private writeOp(context: SqlBuildContext, op: FilterOperator, args: unknown[]): void {
      switch (op) {
         case "=":
            context.addStrings(" = ");
            context.addValues(args[0]);
            break;
         case "not":
         case "!=":
            context.addStrings(" <> ");
            context.addValues(args[0]);
            break;
         case ">":
            context.addStrings(" > ");
            context.addValues(args[0]);
            break;
         case ">=":
            context.addStrings(" >= ");
            context.addValues(args[0]);
            break;
         case "<":
            context.addStrings(" < ");
            context.addValues(args[0]);
            break;
         case "<=":
            context.addStrings(" <= ");
            context.addValues(args[0]);
            break;
         case "between":
            if (!args.length) {
               context.addStrings(" is null");
               break;
            }
            context.addStrings(" between ");
            context.addValues(args[0]);
            context.addStrings(" and ");
            context.addValues(args[1]);
            break;
         case "in": {
            if (!args.length) {
               context.addStrings(" is null");
               break;
            }
            context.addStrings(" in (");
            for (let i = 0; i < args.length; i++) {
               if (i > 0) context.addStrings(", ");
               context.addValues(args[i]);
            }
            context.addStrings(")");
            break;
         }
         case "notIn": {
            if (!args.length) {
               context.addStrings(" is not null");
               break;
            }
            context.addStrings(" not in (");
            for (let i = 0; i < args.length; i++) {
               if (i > 0) context.addStrings(", ");
               context.addValues(args[i]);
            }
            context.addStrings(")");
            break;
         }
         case "like":
            context.addStrings(" like ");
            context.addValues(args[0]);
            break;
         case "notLike":
            context.addStrings(" not like ");
            context.addValues(args[0]);
            break;
         case "isNull":
            context.addStrings(" is null");
            break;
         case "isNotNull":
            context.addStrings(" is not null");
            break;
      }
   }
}

/**
 * HAVING filter operator — emits conditions on aggregate aliases from the select param.
 */
export function havingBy<ParamName extends string = "havingBy">(
   table: SqlTableAny,
   paramName?: ParamName,
   selectParamName?: string,
): SqlHavingBy<ParamName> {
   return new SqlHavingBy(table, (paramName ?? "havingBy") as ParamName, selectParamName ?? "select");
}
