import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#/core/builder/sql-build-options.js";
import { isError } from "#/lib/is-error.js";
import { Lazy } from "#/lib/lazy.js";
import { SqlJsonSchema } from "#/core/utils/sql-json-schema.js";

export type TypeOf<S> = S extends { readonly [TYPE]?: infer R } ? R : void;
export type ArgsOf<S> = S extends { readonly [ARGS]?: infer R } ? R : void;
export type ParamsOf<S> = S extends { readonly [PARAMS]?: infer R } ? R : void;
export type RowOf<S> = S extends { readonly [ROW]?: infer R } ? R : void;

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never;

export type RowsOfArgs<T> = {
   [K in keyof T as RowOf<T[K]> extends Record<string, unknown> ? K : never]: RowOf<T[K]>;
};

type CollectParams<T> =
   ParamsOf<T> extends Record<string, unknown>
      ? ParamsOf<T>
      : T extends Record<string, unknown>
        ? UnionToIntersection<{ [K in keyof T]-?: CollectParams<NonNullable<T[K]>> }[keyof T]>
        : never;

export type ParamsOfArgs<T> = [CollectParams<T>] extends [never]
   ? void
   : CollectParams<T> extends Record<string, unknown>
     ? CollectParams<T>
     : void;

export declare const ROW: unique symbol;
export declare const TYPE: unique symbol;
export declare const PARAMS: unique symbol;
export declare const ARGS: unique symbol;

export type SqlOptions = Pick<Sql, "id"> & Partial<Pick<Sql, "tag">> & { hashId?: () => string };

export abstract class Sql {
   declare readonly [ROW]?: unknown;
   declare readonly [TYPE]?: unknown;
   declare readonly [PARAMS]?: unknown;
   declare readonly [ARGS]?: unknown;

   readonly id: string;
   readonly type: string;
   readonly tag: string | null;
   private readonly hashIdLazy: Lazy<string>;

   protected constructor(options: SqlOptions) {
      this.id = `${this.constructor.name}#${nextId(this.constructor.name)}`;
      const name = this.constructor.name;
      const fallback = options.id ?? "";
      this.hashIdLazy = new Lazy(
         options.hashId ? () => `${name}#(${options.hashId!()})` : () => `${name}#(${fallback})`,
      );

      if (options.tag || options.id) {
         this.id += "(";
      }

      if (options.tag) {
         this.id += `#${options.tag}#`;
      }

      if (options.id) {
         this.id += `${options.id}`;
      }

      if (options.tag || options.id) {
         this.id += ")";
      }

      this.type = this.constructor.name;
      this.tag = options?.tag ?? null;
   }

   get hashId() {
      return this.hashIdLazy.value;
   }

   get jsonSchema(): SqlJsonSchema {
      return {};
   }

   protected abstract write<T>(context: SqlBuildContext, options?: SqlBuildOptions | null, scope?: T | null): void;

   build(context: SqlBuildContext, options?: SqlBuildOptions | null, ...args: unknown[]) {
      try {
         this.write(context, options, ...args);
      } catch (err) {
         if (isError(err)) {
            err.message = `Error building '${this.id}' in query '${context.query?.id ?? "-"}'\\n${err.message}`;
         }

         throw err;
      }
   }

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
