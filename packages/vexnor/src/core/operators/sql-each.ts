import { PARAMS, Sql, SqlOptions } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#/core/builder/sql-build-options.js";
import { SqlQuery } from "#/core/query/sql-query.js";

/**
 * Cursor reference for the current element inside an `each()` iteration.
 * Typed as the element type of the array param.
 *
 * Used inside the `each()` template to reference the current iteration value.
 */
export class SqlEachIt extends Sql {
   constructor() {
      super({
         type: "SqlEachIt",
         id: "each.it",
         hashId: "each.it",
      } satisfies SqlOptions);
   }

   write(context: SqlBuildContext): void {
      // Resolved at runtime by SqlEach during iteration — emits a placeholder for the current value
      context.addValues((context as SqlEachContext)._eachCurrentValue);
   }
}

/** Context extension used during each() iteration to pass the current element */
export type SqlEachContext = SqlBuildContext & { _eachCurrentValue: unknown };

/** Singleton cursor for use inside `each()` templates */
const _eachIt = new SqlEachIt();

/**
 * Returns the cursor reference for the current array element inside `each()`.
 *
 * @example
 * sql`WHERE ${Account.$accountId} IN (${each('ids', sql`${each.it()}`)})`
 */
each.it = function eachIt(): SqlEachIt {
   return _eachIt;
};

/**
 * A portable iteration primitive that repeats a SQL template for each element
 * in an array parameter.
 *
 * Elements are comma-separated by default.
 *
 * @example
 * // Simple IN-list
 * sql`WHERE ${Account.$accountId} IN (${each('ids')})`
 *
 * @example
 * // With a template per element
 * sql`VALUES ${each('rows', sql`(${each.it()})`)}` 
 */
export class SqlEach<T extends Record<string, unknown[]>> extends Sql {
   declare readonly [PARAMS]: T;

   readonly paramName: string;
   readonly template: Sql | null;
   readonly separator: string;

   constructor(paramName: string, template?: Sql | null, separator?: string) {
      const hashId = `${paramName}|${template?.hashId ?? "scalar"}`;
      super({
         type: "SqlEach",
         id: paramName,
         hashId,
      } satisfies SqlOptions);

      this.paramName = paramName;
      this.template = template ?? null;
      this.separator = separator ?? ", ";
   }

   write(context: SqlBuildContext, options?: SqlBuildOptions | null): void {
      const params = context.params as Record<string, unknown> | null;
      const array = params?.[this.paramName];

      if (!Array.isArray(array) || array.length === 0) return;

      for (let i = 0; i < array.length; i++) {
         if (i > 0) context.addStrings(this.separator);

         if (!this.template) {
            // No template — emit a placeholder per element
            context.addValues(array[i]);
         } else {
            // Inject current element into context for SqlEachIt to pick up
            const eachContext = context as SqlEachContext;
            const prev = eachContext._eachCurrentValue;
            eachContext._eachCurrentValue = array[i];

            if (this.template instanceof SqlQuery) {
               this.template.build(context, options, { queryType: "inline" });
            } else {
               this.template.build(context, options);
            }

            eachContext._eachCurrentValue = prev;
         }
      }
   }
}

/**
 * Repeats a SQL fragment for each element in an array parameter.
 * Elements are comma-separated by default.
 *
 * When no template is provided, emits a single placeholder per element
 * (suitable for IN-lists). When a template is provided, use `each.it()`
 * inside it to reference the current element.
 *
 * @param paramName - The array parameter name
 * @param template - Optional SQL template to repeat per element
 * @param separator - Separator between elements (default: ", ")
 */
export function each<T extends Record<string, unknown[]>>(
   paramName: Extract<keyof T, string>,
   template?: Sql,
   separator?: string,
): SqlEach<T> {
   return new SqlEach<T>(paramName, template, separator);
}
