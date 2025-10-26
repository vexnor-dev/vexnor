import { SqlQueryContext } from "./query/index.js";
import { x } from "../x.js";
import { SqlBuildOptions } from "./sql-types.js";

/**
 * A unique symbol to identify instances of the `Sql` class and its subclasses.
 * This is used as a robust alternative to `instanceof` which can fail with proxies.
 */
export const $$$IS_SQL$$$ = Symbol.for("isValnorSql");

export function isSql(item: unknown): item is Sql {
   if (!item) return false;

   return Boolean((item as Sql)[$$$IS_SQL$$$]);
}

export type SqlOptions = {
   wrap?: boolean;
};

export abstract class Sql {
   readonly wrap: boolean | undefined;

   protected constructor(options?: SqlOptions) {
      this.wrap = x(() => {
         if (options?.wrap === undefined) return true;

         return options.wrap;
      });
   }

   /**
    * @internal
    */
   public readonly [$$$IS_SQL$$$] = true;

   /**
    * Build the Sql token using the context and options
    * @param context
    * @param options
    */
   abstract $build(context: SqlQueryContext, options?: SqlBuildOptions): void;
}
