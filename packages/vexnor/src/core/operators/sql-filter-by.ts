import { PARAMS, Sql, SqlOptions } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlTable } from "#/core/schema/sql-table.js";
import { SqlTableColumnAny } from "#/core/schema/sql-table-column.js";
import { BuildSqlParams, PathToNested, SqlParam } from "#/core/query/sql-param.js";
import { isPrimitive } from "#/lib/primitive.js";
import { SqlBuildError } from "#/core/sql-build-error.js";
import { resolvePath } from "#/core/query/resolve-path.js";

const FilterOperator = [
   "=",
   "not",
   ">",
   ">=",
   "<",
   "<=",
   "!=",
   "between",
   "in",
   "notIn",
   "like",
   "notLike",
   "isNull",
   "isNotNull",
] as const;

export type FilterOperator = (typeof FilterOperator)[number];

export const filterOperators: Set<string> = new Set(FilterOperator);

/**
 * A single condition entry: `{ column: value | [op, ...args] }` or `{ or: [...] }`.
 */
export type FilterCondition<T extends Record<string, unknown> = Record<string, unknown>> =
   | { [K in keyof T]?: T[K] | [FilterOperator, ...unknown[]] }
   | { or: FilterConditionList<T> };

/**
 * An array of conditions — entries are AND'd together.
 */
export type FilterConditionList<T extends Record<string, unknown> = Record<string, unknown>> = FilterCondition<T>[];

export type SqlFilterParams<T extends { Select: Record<string, unknown> }, ParamName extends string> = PathToNested<
   ParamName,
   Partial<T["Select"]> | FilterConditionList<T["Select"]> | null | undefined
>;

/**
 * Portable WHERE filterBy operator. Supports:
 * - Equality via bare values
 * - All comparison/range/list/pattern/null operators via [op, ...args] tuples
 * - OR groups via { or: [...] }
 * - Backwards compatible with legacy `{ col: value }` object form
 *
 * @example
 * // Legacy (backwards compatible)
 * params: { filterBy: { email: 'jane@example.com', status: 'active' } }
 *
 * @example
 * // Extended with operators + OR
 * params: { filterBy: [
 *   { status: 'active' },
 *   { createdAt: ['>=', '2024-01-01'] },
 *   { or: [{ email: ['like', '%@vip.com'] }, { parentId: ['isNotNull'] }] }
 * ]}
 */
export class SqlFilterBy<T extends { Select: Record<string, unknown> }, ParamName extends string> extends Sql {
   declare readonly [PARAMS]: SqlFilterParams<T, ParamName>;

   readonly table: SqlTable<T>;
   readonly paramName: ParamName;
   readonly params: BuildSqlParams<T>;
   readonly suffix: string | null;
   readonly prefix: string | null;
   readonly allowedColumns: Set<string>;

   constructor(
      table: SqlTable<T>,
      options: {
         paramName: ParamName;
         suffix?: string;
         prefix?: string;
         omit?: (keyof T["Select"] & string)[];
         include?: (keyof T["Select"] & string)[];
      },
   ) {
      super({
         type: "SqlFilter",
         id: `${table.tableInfo.name}.${options.paramName}`,
         hashId: `${table.hashId}|${options.paramName}`,
      } satisfies SqlOptions);

      this.table = table;
      this.paramName = options.paramName ?? "filterBy";
      this.suffix = options?.suffix ?? null;
      this.prefix = options?.prefix ?? null;

      const keys = new Set(options.include ?? table.colKeys);
      if (options.omit) for (const k of options.omit) keys.delete(k);
      const fieldNames = [...keys, "or", "and"];
      this.allowedColumns = keys;

      this.params = {
         [this.paramName]: new SqlParam({
            name: this.paramName,
            validation: {
               obj: {
                  fieldNames,
                  operators: {
                     "<": { args: 1 },
                     "<=": { args: 1 },
                     ">": { args: 1 },
                     ">=": { args: 1 },
                     "!=": { args: 1 },
                     "=": { args: 1 },
                     in: { args: "variadic" },
                     notIn: { args: "variadic" },
                     like: { args: 1 },
                     notLike: { args: 1 },
                     isNull: { args: 0 },
                     isNotNull: { args: 0 },
                     between: { args: 2 },
                  },
               },
            },
            isContext: false,
         }),
      } as BuildSqlParams<T>;
   }

   write(context: SqlBuildContext): void {
      if (!context.params) {
         const columns: Record<string, string> = {};
         for (const [key, col] of Object.entries(this.table.cols)) {
            const column = col as SqlTableColumnAny;
            // Build column in current context to get alias-qualified name
            const before = context.tokens.length;
            column.build(context);
            // Extract what was just written and remove it from the token stream
            const added = context.tokens
               .slice(before)
               .map((t) => (t as { value: string }).value ?? "")
               .join("");
            (context as unknown as { _tokens: unknown[] })._tokens.length = before;
            columns[key.slice(1)] = added;
         }
         context.addOperator({
            type: "filter",
            param: this.paramName,
            columns,
            ...(this.prefix ? { prefix: this.prefix } : {}),
            ...(this.suffix ? { suffix: this.suffix } : {}),
         });
         return;
      }

      const filterData = resolvePath(context.params as Record<string, unknown>, this.paramName) as Record<string, unknown> | FilterConditionList | null | undefined;

      if (!filterData) return;

      // Detect legacy object form vs extended array form
      const conditions: FilterConditionList = Array.isArray(filterData)
         ? filterData
         : this.legacyToConditions(filterData);

      if (!conditions.length) return;

      if (this.prefix) context.addStrings(this.prefix);
      this.writeConditions(context, conditions, "and");
      if (this.suffix) context.addStrings(this.suffix);
   }

   /**
    * Convert legacy `{ col: value }` object to array-of-conditions form.
    */
   private legacyToConditions(obj: Record<string, unknown>): FilterConditionList {
      const conditions: FilterConditionList = [];
      for (const [key, value] of Object.entries(obj)) {
         if (value === undefined) continue;
         conditions.push({ [key]: value } as FilterCondition);
      }
      return conditions;
   }

   /**
    * Emit a list of conditions joined by the given combinator (and/or).
    */
   private writeConditions(context: SqlBuildContext, conditions: FilterConditionList, joiner: "and" | "or"): void {
      let emitted = 0;
      for (const condition of conditions) {
         if ("or" in condition) {
            const orConditions = (condition as { or: FilterConditionList }).or;
            if (!orConditions.length) continue;
            if (emitted > 0) context.addStrings(` ${joiner} `);
            context.addStrings("(");
            this.writeConditions(context, orConditions, "or");
            context.addStrings(")");
            emitted++;
         } else {
            // Regular condition: { column: value | [op, ...args] }
            for (const [key, value] of Object.entries(condition)) {
               if (value === undefined) continue;
               if (emitted > 0) context.addStrings(` ${joiner} `);
               this.writeEntry(context, key, value);
               emitted++;
            }
         }
      }
   }

   /**
    * Emit a single column condition.
    */
   private writeEntry(context: SqlBuildContext, key: string, value: unknown): void {
      if (!this.allowedColumns.has(key)) throw new SqlBuildError(`Column not found: ${key}`);
      const col = this.table.cols[`$${key}` as `$${string}`] as SqlTableColumnAny | undefined;
      if (!col) throw new SqlBuildError(`Column not found: ${key}`);

      if (Array.isArray(value)) {
         // Tuple form: [op, ...args]
         const [op, ...args] = value as [string, ...unknown[]];
         if (!filterOperators.has(op)) throw new SqlBuildError(`Invalid filter operator: ${op}`);
         this.writeOp(context, col, op as FilterOperator, args);
      } else {
         // Bare value — equality
         if (!isPrimitive(value)) throw new SqlBuildError(`Filter value is not a primitive: ${String(value)}`);
         col.build(context);
         context.addStrings(" = ");
         context.addValues(value);
      }
   }

   /**
    * Emit SQL for a specific operator.
    */
   private writeOp(context: SqlBuildContext, col: SqlTableColumnAny, op: FilterOperator, args: unknown[]): void {
      switch (op) {
         case "=":
            col.build(context);
            context.addStrings(" = ");
            context.addValues(args[0]);
            break;
         case "not":
         case "!=":
            col.build(context);
            context.addStrings(" <> ");
            context.addValues(args[0]);
            break;
         case ">":
            col.build(context);
            context.addStrings(" > ");
            context.addValues(args[0]);
            break;
         case ">=":
            col.build(context);
            context.addStrings(" >= ");
            context.addValues(args[0]);
            break;
         case "<":
            col.build(context);
            context.addStrings(" < ");
            context.addValues(args[0]);
            break;
         case "<=":
            col.build(context);
            context.addStrings(" <= ");
            context.addValues(args[0]);
            break;
         case "between":
            col.build(context);
            context.addStrings(" between ");
            context.addValues(args[0]);
            context.addStrings(" and ");
            context.addValues(args[1]);
            break;
         case "in": {
            if (!args.length) {
               context.addStrings("1 = 0");
               break;
            }
            col.build(context);
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
               context.addStrings("1 = 1");
               break;
            }
            col.build(context);
            context.addStrings(" not in (");
            for (let i = 0; i < args.length; i++) {
               if (i > 0) context.addStrings(", ");
               context.addValues(args[i]);
            }
            context.addStrings(")");
            break;
         }
         case "like":
            col.build(context);
            context.addStrings(" like ");
            context.addValues(args[0]);
            break;
         case "notLike":
            col.build(context);
            context.addStrings(" not like ");
            context.addValues(args[0]);
            break;
         case "isNull":
            col.build(context);
            context.addStrings(" is null");
            break;
         case "isNotNull":
            col.build(context);
            context.addStrings(" is not null");
            break;
      }
   }
}

/**
 * WHERE filter operator — emits conditions from a filter param.
 *
 * Supports bare values (equality), operator tuples, and OR groups.
 * Validates column names and operator types at build time.
 *
 * @param table - The table to resolve column names from
 * @param paramName - The parameter name containing the filter data
 */
export function filterBy<
   T extends { Select: Record<string, unknown> },
   ParamName extends string | "filterBy" = "filterBy",
>(table: SqlTable<T>, options?: ParamName | { paramName?: ParamName; omit?: (keyof T["Select"] & string)[]; include?: (keyof T["Select"] & string)[]; suffix?: string; prefix?: string }): SqlFilterBy<T, ParamName> {
   const opts = typeof options === "string" ? { paramName: options } : options ?? {};
   return new SqlFilterBy(table, { paramName: (opts.paramName ?? "filterBy") as ParamName, ...opts });
}
