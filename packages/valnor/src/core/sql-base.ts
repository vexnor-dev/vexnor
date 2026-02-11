import { SqlBuildContext, SqlBuildOptions } from "./query/index.js";

export type SqlOptions = {
   wrap?: boolean;
   ID: string;
};

const IDs = new Set<string>();

export type TypeOf<S> = S extends { readonly [TYPE]?: infer R } ? R : unknown;
export type ParamsOf<S> = S extends { readonly [PARAMS]?: infer P } ? P : unknown;
export type RowOf<S> = S extends { readonly [ROW]?: infer R } ? R : unknown;

export declare const ROW: unique symbol;
export declare const TYPE: unique symbol;
export declare const PARAMS: unique symbol;

/**
 * Base class for all SQL tokens
 */
export abstract class Sql {
   declare readonly [ROW]?: unknown; // phantom, public
   declare readonly [TYPE]?: unknown; // phantom, public
   declare readonly [PARAMS]?: unknown; // phantom, public

   /**
    * Whether to wrap the SQL token in parentheses
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
    * Build the SQL token using the context and options
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
