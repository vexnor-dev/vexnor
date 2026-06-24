import { PARAMS, Sql, SqlOptions } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#/core/builder/sql-build-options.js";
import { SqlQuery } from "#/core/query/sql-query.js";
import { SqlTableAny } from "#/core/schema/sql-table.js";
import { SqlTableColumnAny } from "#/core/schema/sql-table-column.js";

// ─── Context extension for eachObject iteration ─────────────────────────────

export type SqlEachObjectContext = SqlBuildContext & {
   _eachObjectCurrentKey: string;
   _eachObjectCurrentValue: unknown;
   _eachObjectTable: SqlTableAny | null;
};

// ─── eachKey() cursor ───────────────────────────────────────────────────────

/**
 * Cursor that resolves to the current object key during `eachObject()` iteration.
 * When used with a table context (via `colInTable`), resolves to the column reference.
 */
export class SqlEachKey extends Sql {
   constructor() {
      super({
         type: "SqlEachKey",
         id: "eachKey",
         hashId: "eachKey",
      } satisfies SqlOptions);
   }

   write(context: SqlBuildContext): void {
      const ctx = context as SqlEachObjectContext;
      const key = ctx._eachObjectCurrentKey;
      const table = ctx._eachObjectTable;

      if (table) {
         // Resolve to the column reference
         const col = table.cols[`$${key}` as `$${string}`] as SqlTableColumnAny | undefined;
         if (col) {
            col.build(context);
            return;
         }
      }

      // Fallback: emit the key as a quoted identifier
      context.addQuotes(key);
   }
}

// ─── eachValue() cursor ─────────────────────────────────────────────────────

/**
 * Cursor that resolves to the current object value during `eachObject()` iteration.
 * Emits a placeholder bound to the current value.
 */
export class SqlEachValue extends Sql {
   constructor() {
      super({
         type: "SqlEachValue",
         id: "eachValue",
         hashId: "eachValue",
      } satisfies SqlOptions);
   }

   write(context: SqlBuildContext): void {
      const ctx = context as SqlEachObjectContext;
      context.addValues(ctx._eachObjectCurrentValue);
   }
}

// ─── Singletons ─────────────────────────────────────────────────────────────

const _eachKey = new SqlEachKey();
const _eachValue = new SqlEachValue();

/**
 * Returns a cursor referencing the current key in an `eachObject()` iteration.
 * When inside a `colInTable()` gate, resolves to the table column reference.
 */
export function eachKey(): SqlEachKey {
   return _eachKey;
}

/**
 * Returns a cursor referencing the current value in an `eachObject()` iteration.
 * Emits a bind placeholder for the value.
 */
export function eachValue(): SqlEachValue {
   return _eachValue;
}

// ─── colInTable() gate ──────────────────────────────────────────────────────

/**
 * Gate that only includes the body when the current `eachKey()` maps to a
 * valid column on the given table. Also sets the table context so that
 * `eachKey()` resolves to the proper column reference.
 */
export class SqlColInTable extends Sql {
   readonly table: SqlTableAny;
   readonly key: Sql;
   readonly body: Sql;

   constructor(table: SqlTableAny, key: Sql, body: Sql) {
      super({
         type: "SqlColInTable",
         id: table.tableInfo.name,
         hashId: `${table.hashId}|${key.hashId}|${body.hashId}`,
      } satisfies SqlOptions);

      this.table = table;
      this.key = key;
      this.body = body;
   }

   write(context: SqlBuildContext, options?: SqlBuildOptions | null): void {
      const ctx = context as SqlEachObjectContext;
      const key = ctx._eachObjectCurrentKey;

      // Gate: skip if key is not a column on the table
      const col = this.table.cols[`$${key}` as `$${string}`] as SqlTableColumnAny | undefined;
      if (!col) return;

      // Set table context for eachKey() resolution
      const prevTable = ctx._eachObjectTable;
      ctx._eachObjectTable = this.table;

      if (this.body instanceof SqlQuery) {
         this.body.build(context, options, { queryType: "inline" });
      } else {
         this.body.build(context, options);
      }

      ctx._eachObjectTable = prevTable;
   }
}

/**
 * Gate: only includes the body SQL when the current iteration key (`eachKey()`)
 * is a valid column on the given table. Also enables `eachKey()` to resolve
 * to the proper quoted column name.
 *
 * @param table - The table to validate against
 * @param key - The key cursor (use `eachKey()`)
 * @param body - SQL fragment to include when key is valid
 *
 * @example
 * eachObject<{ set: IAccountUpdate }>('set',
 *   colInTable(Account, eachKey(), sql`${eachKey()} = ${eachValue()}`)
 * )
 */
export function colInTable(table: SqlTableAny, key: Sql, body: Sql): SqlColInTable {
   return new SqlColInTable(table, key, body);
}

// ─── SqlEachObject ──────────────────────────────────────────────────────────

/**
 * Iterates over the key-value pairs of an object parameter and repeats the
 * template for each entry. Use `eachKey()` and `eachValue()` inside the
 * template to reference the current pair.
 *
 * @example
 * // UPDATE SET
 * sql`
 *   UPDATE ${Account}
 *   SET ${eachObject<{ set: IAccountUpdate }>('set',
 *     colInTable(Account, eachKey(), sql`${eachKey()} = ${eachValue()}`)
 *   )}
 *   WHERE ${Account.$accountId} = ${param<{ accountId: string }>('accountId')}
 * `
 */
export class SqlEachObject<T extends Record<string, Record<string, unknown>>> extends Sql {
   declare readonly [PARAMS]: T;

   readonly paramName: string;
   readonly template: Sql;
   readonly separator: string;

   constructor(paramName: string, template: Sql, separator?: string) {
      const hashId = `${paramName}|${template.hashId}`;
      super({
         type: "SqlEachObject",
         id: paramName,
         hashId,
      } satisfies SqlOptions);

      this.paramName = paramName;
      this.template = template;
      this.separator = separator ?? ", ";
   }

   write(context: SqlBuildContext, options?: SqlBuildOptions | null): void {
      const params = context.params as Record<string, unknown> | null;
      const obj = params?.[this.paramName] as Record<string, unknown> | null | undefined;

      if (!obj || typeof obj !== "object") return;

      const ctx = context as SqlEachObjectContext;
      const prevKey = ctx._eachObjectCurrentKey;
      const prevValue = ctx._eachObjectCurrentValue;
      const prevTable = ctx._eachObjectTable;

      // Pre-filter entries that will produce output (gate check)
      const entries = Object.entries(obj);
      let emitted = 0;

      for (const [key, value] of entries) {
         ctx._eachObjectCurrentKey = key;
         ctx._eachObjectCurrentValue = value;
         ctx._eachObjectTable = prevTable ?? null;

         // If gate is a SqlColInTable, check if it would pass before emitting separator
         if (this.template instanceof SqlColInTable) {
            const col = this.template.table.cols[`$${key}` as `$${string}`];
            if (!col) continue;
         }

         if (emitted > 0) context.addStrings(this.separator);

         if (this.template instanceof SqlQuery) {
            this.template.build(context, options, { queryType: "inline" });
         } else {
            this.template.build(context, options);
         }

         emitted++;
      }

      ctx._eachObjectCurrentKey = prevKey;
      ctx._eachObjectCurrentValue = prevValue;
      ctx._eachObjectTable = prevTable;
   }
}

/**
 * Iterates over key-value pairs of an object parameter. Use `eachKey()` and
 * `eachValue()` inside the template to reference the current pair.
 *
 * Combined with `colInTable()`, provides a gate that skips keys not present
 * on the target table.
 *
 * @param paramName - The object parameter name
 * @param template - SQL template to repeat per key-value pair
 * @param separator - Separator between entries (default: ", ")
 */
export function eachObject<T extends Record<string, Record<string, unknown>>>(
   paramName: Extract<keyof T, string>,
   template: Sql,
   separator?: string,
): SqlEachObject<T> {
   return new SqlEachObject<T>(paramName, template, separator);
}
