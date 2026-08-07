// Browser entry — excludes mongodb driver dependencies.
// Used by bundlers (webpack/vite) when the package is imported in client-side code.

export { collection, isMongoCollection, COLLECTION_REF } from "#src/collection.js";
export type { MongoCollection, CollectionOptions } from "#src/collection.js";

export { MongoQuery, MONGODB_PLUGIN_NAME } from "#src/mongo-query.js";
export type { MongoExecutionArgs } from "#src/mongo-query.js";

export type {
   SchemaDescriptor,
   FieldDescriptor,
   ScalarDescriptor,
   ObjectDescriptor,
   ArrayOfObjectsDescriptor,
   ArrayOfScalarsDescriptor,
} from "#src/schema-descriptor.js";
export type {
   MongoFilter,
   MongoFindOptions,
   MongoOperation,
   MongoParamInfo,
   MongoQueryMetadata,
} from "#src/mongo-types.js";

export { canonicalJson } from "#src/canonical-json.js";
