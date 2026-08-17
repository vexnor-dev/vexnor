import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#src/core/builder/sql-build-options.js";
import { isError } from "#src/lib/is-error.js";
import { SqlJsonSchema } from "#src/core/utils/sql-json-schema.js";
import { ok } from "#src/lib/assert.js";

/** Extracts the value or result-row type explicitly carried by a Vexnor SQL token or query. */
export type TypeOf<S> = S extends { readonly [TYPE]: infer R } ? R : void;

/** Extracts the direct argument type explicitly carried by a Vexnor SQL token or query. */
export type ArgsOf<S> = S extends { readonly [ARGS]: infer R } ? R : void;

/** Extracts the complete named-parameter object explicitly carried by a Vexnor SQL token or query. */
export type ParamsOf<S> = S extends { readonly [PARAMS]: infer R } ? R : void;

/** Extracts the result-row contribution explicitly carried by a Vexnor SQL token or query. */
export type RowOf<S> = S extends { readonly [ROW]: infer R } ? R : void;

/** Extracts the generated source identifier explicitly carried by a Vexnor table or query. */
export type SourceOf<S> = S extends { readonly [SOURCE]: infer R } ? R : never;

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never;

export type RowsOfArgs<T> = {
   [K in keyof T as RowOf<T[K]> extends Record<string, unknown> ? K : never]: RowOf<T[K]>;
};

type CollectParams<T> =
   ParamsOf<T> extends Record<string, unknown>
      ? ParamsOf<T>
      : T extends { readonly [SQL_TOKEN]: never }
        ? never
        : T extends Record<string, unknown>
          ? { [K in keyof T]-?: CollectParams<NonNullable<T[K]>> } extends infer Collected
             ? Collected extends Record<string, never>
                ? never
                : UnionToIntersection<
                     Collected[keyof Collected & keyof T] extends infer U
                        ? U extends Record<string, unknown>
                           ? U
                           : never
                        : never
                  >
             : never
          : never;

export type ParamsOfArgs<T> = [CollectParams<T>] extends [never]
   ? void
   : CollectParams<T> extends Record<string, unknown>
     ? CollectParams<T>
     : void;

/**
 * Internal type-metadata markers for repository-owned SQL primitive implementations.
 *
 * `Sql` intentionally declares none of these markers. A typed subclass declares
 * only the metadata it owns, using required properties such as
 * `declare readonly [ROW]: Row`. Required ownership keeps `TypeOf`, `RowOf`,
 * `ParamsOf`, `ArgsOf`, and `SourceOf` from structurally matching unrelated SQL
 * tokens and recursively expanding nested column metadata. Rendering-only tokens
 * declare no metadata markers.
 *
 * Application query code must use Vexnor's concrete query and token types instead
 * of importing or imitating these symbols.
 */
export const ROW: unique symbol = Symbol("ROW");
export const TYPE: unique symbol = Symbol("TYPE");
export const PARAMS: unique symbol = Symbol("PARAMS");
export const ARGS: unique symbol = Symbol("ARGS");
export const SOURCE: unique symbol = Symbol("SOURCE");
export const SQL_TOKEN: unique symbol = Symbol("SQL_TOKEN");
export const QUERY: unique symbol = Symbol("QUERY");

export type SqlOptions = Pick<Sql, "id" | "hashId"> & Partial<Pick<Sql, "tag">> & { type?: string };

export abstract class Sql {
   declare readonly [SQL_TOKEN]: never;

   readonly id: string;
   readonly type: string;
   readonly tag: string | null;
   readonly hashId: string;

   protected constructor(options: SqlOptions) {
      this.id = `${this.constructor.name}#${nextId(this.constructor.name)}`;
      ok(options.hashId, `Invalid hashId '${options.hashId}' provided for ${options.type ?? this.constructor.name}`);
      this.hashId = `${options.type ?? this.constructor.name}#(${options.hashId})`;

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

      this.type = options.type ?? this.constructor.name;
      this.tag = options?.tag ?? null;
   }

   get jsonSchema(): SqlJsonSchema {
      return {};
   }

   /** AI documentation for this operator. Override in subclasses to contribute docs. */
   get aiPrompt(): string | null {
      return null;
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
