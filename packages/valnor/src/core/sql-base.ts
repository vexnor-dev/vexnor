import { SqlBuildContext, SqlBuildOptions } from "./query/index.js";

export type SqlOptions = { wrap?: boolean; ID: string };

/**
 * Base class for all Sql tokens
 */
export abstract class Sql {
   /**
    * Whether to wrap the Sql token in parentheses
    */
   readonly wrap: boolean | undefined;

   /**
    * Unique identifier for the Sql token
    */
   readonly ID: string;

   protected constructor(options: SqlOptions) {
      this.ID = this.constructor.name + "(" + options.ID + ")" + Math.random().toString(36).substring(2, 6);

      this.wrap = (() => {
         if (options?.wrap === undefined) return true;

         return options.wrap;
      })();
   }

   /**
    * Build the Sql token using the context and options
    * @param context
    * @param options
    */
   abstract build(context: SqlBuildContext, options?: SqlBuildOptions): void;

   toString() {
      return this.ID;
   }

   [Symbol.toStringTag]() {
      return this.toString();
   }
}
