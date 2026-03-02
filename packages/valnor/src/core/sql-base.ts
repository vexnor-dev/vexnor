import { SqlBuildContext, SqlBuildOptions, SqlQueryAny } from "./query/index.js";

export type SqlOptions = {
   wrap?: boolean;
   id: string;
   query?: SqlQueryAny | null;
};

export type TypeOf<S> = S extends { readonly [TYPE]?: infer R } ? R : void;
export type ArgsOf<S> = S extends { readonly [ARGS]?: infer R } ? R : void;
export type ParamsOf<S> = S extends { readonly [PARAMS]?: infer R } ? R : void;
export type RowOf<S> = S extends { readonly [ROW]?: infer R } ? R : void;

export type ParamsOfArgs<T> =
   T extends Record<string, unknown>
      ? { [K in keyof T as ParamsOfArgs<T[K]> extends void ? never : K]: ParamsOfArgs<T[K]> }
      : ArgsOf<T>;

export declare const ROW: unique symbol;
export declare const TYPE: unique symbol;
export declare const PARAMS: unique symbol;
export declare const ARGS: unique symbol;

/**
 * Base class for all SQL tokens
 */
export abstract class Sql {
   declare readonly [ROW]?: unknown; // phantom, public
   declare readonly [TYPE]?: unknown; // phantom, public
   declare readonly [PARAMS]?: unknown; // phantom, public
   declare readonly [ARGS]?: unknown; // phantom, public

   /**
    * Whether to wrap the SQL token in parentheses
    */
   readonly wrap: boolean | undefined;

   /**
    * Unique identifier for the Sql token
    */
   readonly id: string;

   /**
    * The type of the SQL token
    */
   readonly type: string;

   protected constructor(options: SqlOptions) {
      this.id = `${this.constructor.name}#${nextId(this.constructor.name)}${options.id ? `(${options.id})` : ""}`;

      this.wrap = (() => {
         if (options?.wrap === undefined) return true;

         return options.wrap;
      })();

      this.type = this.constructor.name;
   }

   /**
    * Build the SQL token using the context and options
    * @param context
    * @param options
    */
   abstract build(context: SqlBuildContext, options?: SqlBuildOptions): void;

   toString() {
      return this.id;
   }

   [Symbol.toStringTag]() {
      return this.toString();
   }
}

export const classCounters = new Map<string, number>();

export function nextId(className: string): number {
   const current = classCounters.get(className) ?? 0;
   const next = current + 1;
   classCounters.set(className, next);
   return next;
}

export function resetIds() {
   classCounters.clear();
}
