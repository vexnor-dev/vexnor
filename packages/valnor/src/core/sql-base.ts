import { SqlBuildContext, SqlBuildOptions } from "./query/index.js";

export type SqlOptions = {
   wrap?: boolean;
   ID: string;
};

const IDs = new Set<string>();

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
      const newId = () => this.constructor.name + "(" + options.ID + ")" + Math.random().toString(36).substring(2, 6);
      this.ID = (() => {
         let counter = 0;
         let id = "";
         while (counter++ < 3) {
            id = newId();
            if (!IDs.has(id)) {
               IDs.add(id);
               return id;
            }
         }

         throw new Error(`Could not generate unique ID for Sql token: ${this.constructor.name}/${options.ID}`);
      })();

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
