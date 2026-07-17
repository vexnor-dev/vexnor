/**
 * Core MongoDB types for the vexnor MongoDB plugin.
 *
 * MongoFilter<T> extends the MongoDB driver's Filter<T> to accept
 * param/ctx placeholders at leaf positions.
 */
import type { SqlParam } from "@vexnor/core";
import type { Filter, FindOptions, Document } from "mongodb";

// ─── MongoFilter<T> — extends driver Filter to accept param/ctx ──────────────

/**
 * Recursively maps a type so that every leaf scalar position
 * also accepts a SqlParam placeholder.
 */
export type WithParamLeaves<T> = {
   [K in keyof T]?: T[K] extends Record<string, unknown>
      ? WithParamLeaves<T[K]> | SqlParam<{ Name: string; Type: T[K] }>
      : T[K] | SqlParam<{ Name: string; Type: T[K] }>;
};

/**
 * MongoDB filter that accepts param/ctx placeholders at leaf value positions.
 * This extends the driver's Filter<T> to work with vexnor's param system.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MongoFilter<T extends Document> = Filter<T> | WithParamLeaves<T> | Record<string, any>;

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
