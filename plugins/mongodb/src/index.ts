// ─── Collection ──────────────────────────────────────────────────────────────
export { collection, isMongoCollection, COLLECTION_REF } from "#src/collection.js";
export type { MongoCollection, CollectionOptions } from "#src/collection.js";

// ─── Query ───────────────────────────────────────────────────────────────────
export { MongoQuery, MONGODB_PLUGIN_NAME } from "#src/mongo-query.js";
export type { MongoExecutionArgs } from "#src/mongo-query.js";

// ─── Types ───────────────────────────────────────────────────────────────────
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
   DotPaths,
   DotPathType,
   DotPathFilter,
} from "#src/mongo-types.js";

// ─── Registry ────────────────────────────────────────────────────────────────
export {
   MongoQueryRegistry,
   serializeMongoManifest,
} from "#src/registry.js";
export type { MongoQueryMap, MongoManifest, MongoManifestEntry } from "#src/registry.js";

// ─── Plugin ──────────────────────────────────────────────────────────────────
export { VexnorMongoDB, vexnorMongodb } from "#src/vexnor-mongodb.js";
export type { MongoConnectionConfig } from "#src/vexnor-mongodb.js";

// ─── Codegen ─────────────────────────────────────────────────────────────────
export {
   runCodegen,
   generateCollectionFile,
   inferSchemaFromDocuments,
   jsonSchemaToDescriptor,
} from "#src/codegen.js";
export type { MongoCodegenOptions, CodegenResult } from "#src/codegen.js";

// ─── Utilities ───────────────────────────────────────────────────────────────
export { canonicalJson } from "#src/canonical-json.js";
export { substituteParams } from "#src/walk-params.js";

// ─── Default export ──────────────────────────────────────────────────────────
import { vexnorMongodb } from "#src/vexnor-mongodb.js";
export default vexnorMongodb;
