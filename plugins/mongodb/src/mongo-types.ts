/**
 * Core MongoDB types for the vexnor MongoDB plugin.
 *
 * Provides strict type-safe filters:
 * - DotPaths<T> generates all valid dot-path strings for a document type
 * - StrictFilterValue<V> constrains operator expressions to match the field type
 * - MongoFilter<T> rejects invalid field names and mistyped operator values at compile time
 */
import type { SqlParam } from "@vexnor/core";
import type { FindOptions, Document } from "mongodb";

// ─── Dot-path type utilities ─────────────────────────────────────────────────

/**
 * Generates all valid dot-path strings for a document type.
 *
 * Given: { availability: { isAvailable: boolean; isPublished: boolean }; name: string }
 * Produces: "availability" | "availability.isAvailable" | "availability.isPublished" | "name"
 *
 * Handles:
 * - Nested objects (recurses with dot separator)
 * - Arrays of objects (e.g., items[].productId → "items.productId")
 * - Nullable nested objects (strips null from union before recursing)
 * - Stops recursion at depth 5 to prevent infinite types
 */
export type DotPaths<T, Depth extends unknown[] = []> =
   Depth["length"] extends 5
      ? string
      : T extends (infer U)[]
         ? DotPaths<U, [...Depth, unknown]>
         : T extends Date
            ? never
            : T extends object
               ? {
                    [K in keyof T & string]:
                       | K
                       | (NonNullable<T[K]> extends object
                            ? NonNullable<T[K]> extends Date
                               ? never
                               : `${K}.${DotPaths<NonNullable<T[K]>, [...Depth, unknown]>}`
                            : never);
                 }[keyof T & string]
               : never;

/**
 * Resolves the type at a dot-path within a nested document type.
 *
 * DotPathType<{ a: { b: number } }, "a.b"> → number
 * DotPathType<{ items: { qty: number }[] }, "items.qty"> → number
 */
export type DotPathType<T, Path extends string> =
   Path extends `${infer Head}.${infer Tail}`
      ? Head extends keyof T
         ? T[Head] extends (infer U)[]
            ? DotPathType<U, Tail>
            : DotPathType<NonNullable<T[Head]>, Tail>
         : unknown
      : Path extends keyof T
         ? T[Path]
         : unknown;

// ─── Strict MongoDB operator expressions ─────────────────────────────────────

/**
 * Typed comparison operators for a field value.
 * Constrains $gt, $lt, $gte, $lte, $ne to match the field type.
 * Constrains $in, $nin to arrays of the field type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComparisonOperators<V> = {
   $eq?: V | SqlParam<any>;
   $ne?: V | SqlParam<any>;
   $gt?: V | SqlParam<any>;
   $gte?: V | SqlParam<any>;
   $lt?: V | SqlParam<any>;
   $lte?: V | SqlParam<any>;
   $in?: (V | SqlParam<any>)[];
   $nin?: (V | SqlParam<any>)[];
};

/**
 * Element operators — type-agnostic.
 */
type ElementOperators = {
   $exists?: boolean;
   $type?: string | number;
};

/**
 * Array operators for fields that are arrays.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ArrayOperators<V> = V extends (infer Item)[]
   ? {
        $elemMatch?: Item extends object ? ElemMatchFilter<Item> : StrictFilterExpression<Item>;
        $size?: number | SqlParam<any>;
        $all?: (Item | SqlParam<any>)[];
     }
   : object;

/**
 * Filter for $elemMatch — each key of the element can have a value or operator expression.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElemMatchFilter<T> = {
   [K in keyof T & string]?: T[K] | SqlParam<any> | StrictFilterExpression<T[K]>;
};

/**
 * String-specific operators (only valid when V is string).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StringOperators<V> = V extends string
   ? {
        $regex?: string | RegExp | SqlParam<any>;
        $options?: string;
     }
   : object;

/**
 * Negation operator.
 */
type NegationOperator<V> = {
   $not?: StrictFilterExpression<V>;
};

/**
 * The full set of typed operators for a field value V.
 */
type StrictFilterExpression<V> =
   & ComparisonOperators<V>
   & ElementOperators
   & ArrayOperators<V>
   & StringOperators<V>
   & NegationOperator<V>;

/**
 * A filter condition for a single field — accepts:
 * 1. The literal value (equality match)
 * 2. A SqlParam placeholder (runtime value)
 * 3. A typed operator expression ($gt, $in, etc.)
 * 4. For array fields: a single element value (MongoDB matches arrays containing the value)
 *
 * Uses [V] extends [...] to prevent TypeScript from distributing over unions.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StrictFilterCondition<V> = [V] extends [(infer Item)[]]
   ? V | Item | SqlParam<any> | StrictFilterExpression<V>
   : V | SqlParam<any> | StrictFilterExpression<V>;

// ─── Logical operators ($and, $or, $nor) ─────────────────────────────────────

/**
 * Top-level logical operators for combining filter conditions.
 */
type LogicalOperators<T extends Document> = {
   $and?: MongoFilter<T>[];
   $or?: MongoFilter<T>[];
   $nor?: MongoFilter<T>[];
};

// ─── MongoFilter<T> — the strict filter type ─────────────────────────────────

/**
 * Strict filter for top-level fields — each key must exist on T,
 * and the value must match the field's type or be a typed operator expression.
 */
type TopLevelFilter<T> = {
   [K in keyof T & string]?: StrictFilterCondition<T[K]>;
};

/**
 * Strict filter for dot-path fields — each key must be a valid dot-path of T,
 * and the value must match the resolved path type or be a typed operator expression.
 */
type DotPathStrictFilter<T extends Document> = {
   [P in DotPaths<T>]?: StrictFilterCondition<DotPathType<T, P>>;
};

/**
 * MongoDB filter that enforces:
 * - Only valid field names (top-level or dot-path) are accepted as keys
 * - Operator values ($gt, $in, etc.) must match the field's type
 * - Param placeholders accepted at any value position
 * - Logical operators ($and, $or, $nor) combine filters recursively
 *
 * Invalid field names or mistyped operator values cause compile-time errors.
 */
export type MongoFilter<T extends Document> =
   & TopLevelFilter<T>
   & DotPathStrictFilter<T>
   & LogicalOperators<T>;

// ─── Legacy compat: re-export for existing code that uses these ──────────────

/** @deprecated Use MongoFilter<T> directly — this is now the same type */
export type WithParamLeaves<T> = TopLevelFilter<T>;

/** @deprecated Use MongoFilter<T> directly — dot-path filter is now integrated */
export type DotPathFilter<T extends Document> = DotPathStrictFilter<T>;

// ─── MongoFindOptions ────────────────────────────────────────────────────────

/**
 * MongoDB find options that accept param/ctx placeholders for limit/skip.
 */
export type MongoFindOptions<T extends Document> = Omit<FindOptions<T>, "limit" | "skip"> & {
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   limit?: number | SqlParam<any>;
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   skip?: number | SqlParam<any>;
};

// ─── Operation types ─────────────────────────────────────────────────────────

export type MongoOperation =
   | "find"
   | "aggregate"
   | "deleteOne"
   | "deleteMany"
   | "insertOne"
   | "insertMany"
   | "updateOne"
   | "updateMany";

// ─── Param metadata ──────────────────────────────────────────────────────────

export interface MongoParamInfo {
   readonly name: string;
   readonly isContext: boolean;
}

// ─── Query metadata ──────────────────────────────────────────────────────────

export interface MongoQueryMetadata {
   /** Stable hash of the operation descriptor */
   hash: string;
   /** Collection name */
   collection: string;
   /** Operation type */
   operation: MongoOperation;
   /** Declared parameters (extracted from filter/options/pipeline) */
   params: Record<string, MongoParamInfo>;
   /** Source identity (from collection definition) */
   source: string;
   /** Authorization tags */
   authorization: string[];
   /** The serialized operation descriptor (used for hashing and manifest export) */
   descriptor: Record<string, unknown>;
}
