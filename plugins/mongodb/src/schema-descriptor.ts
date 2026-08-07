/**
 * Schema descriptor types for MongoDB collections.
 *
 * The schema descriptor serves two purposes:
 * 1. Runtime type information for the query registry (hash derivation, validation)
 * 2. Cross-runtime manifest export (Go, .NET can use it to deserialize results)
 */

/** Scalar type descriptors */
export type ScalarDescriptor = "string" | "number" | "integer" | "boolean" | "date";

/** A schema descriptor for a single field */
export type FieldDescriptor =
   | ScalarDescriptor
   | ObjectDescriptor
   | ArrayOfObjectsDescriptor
   | ArrayOfScalarsDescriptor;

/** Nested object descriptor — keys map to field descriptors */
export type ObjectDescriptor = { [key: string]: FieldDescriptor };

/** Array of objects — a single-element tuple with an object descriptor */
export type ArrayOfObjectsDescriptor = [ObjectDescriptor];

/** Array of scalars — a single-element tuple with a scalar descriptor */
export type ArrayOfScalarsDescriptor = [ScalarDescriptor];

/** Top-level schema descriptor for a collection document */
export type SchemaDescriptor = ObjectDescriptor;
