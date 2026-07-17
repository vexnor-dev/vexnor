/**
 * Sentinel classes for param() and ctx() placeholders inside MongoDB operations.
 * These are used to mark positions in filters/options/pipelines where runtime
 * values should be substituted during execution.
 */

/** Marker symbol to identify param/ctx placeholders in filter objects */
export const MONGO_PARAM_MARKER = Symbol.for("vexnor.mongodb.param");

/** Represents a runtime parameter placeholder in a MongoDB operation */
export interface MongoParamRef {
   readonly [MONGO_PARAM_MARKER]: true;
   readonly name: string;
   readonly isContext: boolean;
}

/** Type guard for param/ctx references */
export function isMongoParamRef(value: unknown): value is MongoParamRef {
   return (
      typeof value === "object" &&
      value !== null &&
      MONGO_PARAM_MARKER in value &&
      (value as MongoParamRef)[MONGO_PARAM_MARKER] === true
   );
}
