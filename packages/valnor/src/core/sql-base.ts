import { SqlQueryContext } from "./query/index.js";
import { SqlBuildOptions } from "./sql-types.js";

export type SqlOptions = { wrap?: boolean };

export abstract class Sql {
   readonly $$wrap: boolean | undefined;

   protected constructor(options?: SqlOptions) {
      this.$$wrap = (() => {
         if (options?.wrap === undefined) return true;

         return options.wrap;
      })();
   }

   /**
    * Build the Sql token using the context and options
    * @param context
    * @param options
    */
   abstract build(context: SqlQueryContext, options?: SqlBuildOptions): void;
}

// export type InferSqlRowFromRecord<T> =
//    T extends Record<string, unknown>
//       ? { [K in keyof T]: K extends string ? Sql<{ Key: K; Type: T[K] }> : never }
//       : never;
