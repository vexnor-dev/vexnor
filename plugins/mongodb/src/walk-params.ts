/**
 * Walks a MongoDB filter/options/pipeline tree to:
 * 1. Extract all param/ctx declarations
 * 2. Build the serialized operation descriptor with $param/$literal markers
 */
import { SqlParam } from "@vexnor/core";
import { COLLECTION_REF, type MongoCollection } from "#src/collection.js";
import type { MongoParamInfo } from "#src/mongo-types.js";

export interface WalkResult {
   /** The descriptor with $param/$literal markers */
   descriptor: unknown;
   /** Extracted param declarations */
   params: Record<string, MongoParamInfo>;
}

/**
 * Walks an arbitrary value tree (filter, options, pipeline stage, etc.) and:
 * - Replaces SqlParam instances with `{ "$param": name }` or `{ "$ctx": name }`
 * - Replaces collection refs with their string collection name
 * - Wraps literal values in `{ "$literal": value }` when distinguishing from params is needed
 * - Collects all param declarations encountered
 *
 * @param value - The value tree to walk
 * @param params - Accumulator for discovered params (mutated)
 * @param literalWrap - Whether to wrap scalar literals in $literal markers (for filter values)
 */
export function walkValue(
   value: unknown,
   params: Record<string, MongoParamInfo>,
   literalWrap: boolean = false,
): unknown {
   if (value === null || value === undefined) {
      return value;
   }

   // SqlParam — extract and replace with marker
   if (value instanceof SqlParam) {
      params[value.name] = { name: value.name, isContext: value.isContext };
      return value.isContext ? { $ctx: value.name } : { $param: value.name };
   }

   // Collection ref — resolve to string name
   if (isCollectionRef(value)) {
      return value.collectionName;
   }

   // Date — serialize as ISO string
   if (value instanceof Date) {
      return literalWrap ? { $literal: value.toISOString() } : value.toISOString();
   }

   // Array — walk each element
   if (Array.isArray(value)) {
      return value.map((item) => walkValue(item, params, literalWrap));
   }

   // Plain object — walk each value
   if (typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
         result[key] = walkValue(val, params, literalWrap);
      }
      return result;
   }

   // Scalar literal (string, number, boolean)
   if (literalWrap) {
      return { $literal: value };
   }

   return value;
}

/**
 * Walks a filter object, wrapping scalar leaf values in $literal markers.
 * This distinguishes "query for status='shipped'" from "query for status=param('x')".
 */
export function walkFilter(
   filter: unknown,
   params: Record<string, MongoParamInfo>,
): unknown {
   if (filter === null || filter === undefined) {
      return null;
   }

   // SqlParam at top level
   if (filter instanceof SqlParam) {
      params[filter.name] = { name: filter.name, isContext: filter.isContext };
      return filter.isContext ? { $ctx: filter.name } : { $param: filter.name };
   }

   if (Array.isArray(filter)) {
      return filter.map((item) => walkFilter(item, params));
   }

   if (typeof filter === "object") {
      if (isCollectionRef(filter)) {
         return filter.collectionName;
      }

      if (filter instanceof Date) {
         return { $literal: filter.toISOString() };
      }

      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(filter)) {
         // MongoDB operators like $match, $group, etc. — recurse into them
         if (key.startsWith("$")) {
            result[key] = walkFilter(val, params);
         } else {
            // Field-level value — wrap literals
            result[key] = walkFilterValue(val, params);
         }
      }
      return result;
   }

   // Scalar at top level of filter — shouldn't happen but wrap for safety
   return { $literal: filter };
}

/**
 * Walks a filter field value. Scalars are wrapped in $literal.
 * Operator objects like { $gt: 5 } have their values wrapped.
 */
function walkFilterValue(value: unknown, params: Record<string, MongoParamInfo>): unknown {
   if (value === null || value === undefined) {
      return { $literal: value };
   }

   if (value instanceof SqlParam) {
      params[value.name] = { name: value.name, isContext: value.isContext };
      return value.isContext ? { $ctx: value.name } : { $param: value.name };
   }

   if (isCollectionRef(value)) {
      return value.collectionName;
   }

   if (value instanceof Date) {
      return { $literal: value.toISOString() };
   }

   if (Array.isArray(value)) {
      return value.map((item) => walkFilterValue(item, params));
   }

   if (typeof value === "object") {
      // Check if it's a MongoDB operator expression like { $gt: 5, $lt: 10 }
      const keys = Object.keys(value);
      const isOperatorObj = keys.length > 0 && keys.every((k) => k.startsWith("$"));
      if (isOperatorObj) {
         const result: Record<string, unknown> = {};
         for (const [key, val] of Object.entries(value)) {
            result[key] = walkFilterValue(val, params);
         }
         return result;
      }

      // Nested document match — recurse
      return walkFilter(value, params);
   }

   // Scalar value — wrap in $literal
   return { $literal: value };
}

/**
 * Walks find options, extracting params from limit/skip/sort/projection.
 */
export function walkFindOptions(
   options: Record<string, unknown> | undefined | null,
   params: Record<string, MongoParamInfo>,
): Record<string, unknown> | null {
   if (!options) return null;

   const result: Record<string, unknown> = {};

   for (const [key, val] of Object.entries(options)) {
      switch (key) {
         case "limit":
         case "skip":
            if (val instanceof SqlParam) {
               params[val.name] = { name: val.name, isContext: val.isContext };
               result[key] = val.isContext ? { $ctx: val.name } : { $param: val.name };
            } else if (val !== undefined && val !== null) {
               result[key] = { $literal: val };
            }
            break;
         case "sort":
            // Sort is passed through as-is (no params in sort values typically)
            result[key] = walkValue(val, params, false);
            break;
         case "projection":
            // Projection is passed through as-is
            result[key] = walkValue(val, params, false);
            break;
         default:
            result[key] = walkValue(val, params, false);
            break;
      }
   }

   return result;
}

/**
 * Walks an aggregation pipeline, extracting params from all stages.
 */
export function walkPipeline(
   pipeline: unknown[],
   params: Record<string, MongoParamInfo>,
): unknown[] {
   return pipeline.map((stage) => walkFilter(stage, params));
}

// ─── Substitution (for execution) ────────────────────────────────────────────

/**
 * Substitutes $param/$ctx markers with actual runtime values.
 * Used during query execution to produce the final MongoDB operation.
 */
export function substituteParams(
   descriptor: unknown,
   runtimeParams: Record<string, unknown>,
): unknown {
   if (descriptor === null || descriptor === undefined) {
      return descriptor;
   }

   if (Array.isArray(descriptor)) {
      return descriptor.map((item) => substituteParams(item, runtimeParams));
   }

   if (typeof descriptor === "object") {
      const obj = descriptor as Record<string, unknown>;

      // Check for $param marker
      if ("$param" in obj && typeof obj.$param === "string") {
         return runtimeParams[obj.$param];
      }

      // Check for $ctx marker
      if ("$ctx" in obj && typeof obj.$ctx === "string") {
         return runtimeParams[obj.$ctx];
      }

      // Check for $literal marker
      if ("$literal" in obj && Object.keys(obj).length === 1) {
         return obj.$literal;
      }

      // Recurse into object
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(obj)) {
         result[key] = substituteParams(val, runtimeParams);
      }
      return result;
   }

   return descriptor;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isCollectionRef(value: unknown): value is MongoCollection {
   return (
      typeof value === "object" &&
      value !== null &&
      COLLECTION_REF in value &&
      (value as { [COLLECTION_REF]: boolean })[COLLECTION_REF] === true
   );
}


