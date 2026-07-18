/**
 * MongoDB codegen — generates typed collection definitions from an existing database.
 *
 * Strategy:
 * 1. Connect to the database
 * 2. For each collection, check if a JSON Schema validator exists
 * 3. If no validator, sample N documents and infer the merged schema
 * 4. Emit: TypeScript interface + collection<T>() call with pre-filled schema descriptor
 */
import type { Db, Document } from "mongodb";
import type { SchemaDescriptor, FieldDescriptor, ScalarDescriptor } from "#src/schema-descriptor.js";

// ─── Codegen options ─────────────────────────────────────────────────────────

export interface MongoCodegenOptions {
   /** MongoDB connection URI */
   uri: string;
   /** Database name */
   database: string;
   /** Output directory for generated files */
   outDir: string;
   /** Number of documents to sample per collection (default: 1000) */
   sampleSize?: number;
   /** Source identity prefix (default: derived from package.json name + outDir) */
   source?: string;
   /** Collections to include (default: all) */
   collections?: string[];
   /** Collections to exclude */
   exclude?: string[];
}

// ─── Schema inference from JSON Schema validator ─────────────────────────────

interface JsonSchemaProperty {
   bsonType?: string | string[];
   type?: string | string[];
   properties?: Record<string, JsonSchemaProperty>;
   items?: JsonSchemaProperty;
   required?: string[];
   enum?: unknown[];
   description?: string;
}

/**
 * Converts a MongoDB JSON Schema validator to a vexnor SchemaDescriptor.
 */
export function jsonSchemaToDescriptor(schema: JsonSchemaProperty): SchemaDescriptor {
   if (!schema.properties) return {};

   const result: SchemaDescriptor = {};
   for (const [key, prop] of Object.entries(schema.properties)) {
      result[key] = jsonSchemaPropertyToFieldDescriptor(prop);
   }
   return result;
}

function jsonSchemaPropertyToFieldDescriptor(prop: JsonSchemaProperty): FieldDescriptor {
   const bsonType = Array.isArray(prop.bsonType) ? prop.bsonType[0] : prop.bsonType;
   const jsonType = Array.isArray(prop.type) ? prop.type[0] : prop.type;
   const type = bsonType ?? jsonType;

   switch (type) {
      case "string":
      case "objectId":
         return "string";
      case "int":
      case "long":
         return "integer";
      case "double":
      case "decimal":
      case "number":
         return "number";
      case "bool":
      case "boolean":
         return "boolean";
      case "date":
      case "timestamp":
         return "date";
      case "object":
         if (prop.properties) {
            return jsonSchemaToDescriptor(prop);
         }
         return "string"; // fallback for untyped objects
      case "array":
         if (prop.items) {
            const itemType = Array.isArray(prop.items.bsonType)
               ? prop.items.bsonType[0]
               : prop.items.bsonType;
            if (itemType === "object" && prop.items.properties) {
               return [jsonSchemaToDescriptor(prop.items)];
            }
            const scalar = bsonTypeToScalar(itemType ?? "string");
            return [scalar];
         }
         return ["string"]; // fallback
      default:
         return "string"; // fallback for unknown types
   }
}

function bsonTypeToScalar(bsonType: string): ScalarDescriptor {
   switch (bsonType) {
      case "string":
      case "objectId":
         return "string";
      case "int":
      case "long":
         return "integer";
      case "double":
      case "decimal":
      case "number":
         return "number";
      case "bool":
      case "boolean":
         return "boolean";
      case "date":
      case "timestamp":
         return "date";
      default:
         return "string";
   }
}

// ─── Schema inference from document sampling ─────────────────────────────────

/**
 * Infers a schema descriptor by sampling documents from a collection.
 */
export function inferSchemaFromDocuments(documents: Document[]): SchemaDescriptor {
   if (documents.length === 0) return {};

   const merged: SchemaDescriptor = {};

   for (const doc of documents) {
      mergeDocument(merged, doc);
   }

   return merged;
}

function mergeDocument(target: SchemaDescriptor, doc: Document): void {
   for (const [key, value] of Object.entries(doc)) {
      if (value === null || value === undefined) continue;

      const inferred = inferFieldType(value);
      if (inferred !== null) {
         // Only set if not already set (first-seen wins for type conflicts)
         if (!(key in target)) {
            target[key] = inferred;
         }
      }
   }
}

function inferFieldType(value: NonNullable<unknown>): FieldDescriptor | null {
   if (value instanceof Date) return "date";
   if (typeof value === "string") return "string";
   if (typeof value === "boolean") return "boolean";
   if (typeof value === "number") {
      return Number.isInteger(value) ? "number" : "number"; // Can't reliably distinguish int vs float
   }

   if (Array.isArray(value)) {
      if (value.length === 0) return ["string"]; // Can't infer from empty array
      const first = value[0];
      if (typeof first === "object" && first !== null && !(first instanceof Date)) {
         const itemSchema = inferSchemaFromDocuments(value as Document[]);
         return [itemSchema];
      }
      const scalarType = inferScalarType(first);
      return [scalarType];
   }

   if (typeof value === "object") {
      const nested = inferSchemaFromDocuments([value as Document]);
      return nested;
   }

   return "string";
}

function inferScalarType(value: unknown): ScalarDescriptor {
   if (typeof value === "string") return "string";
   if (typeof value === "number") return "number";
   if (typeof value === "boolean") return "boolean";
   if (value instanceof Date) return "date";
   return "string";
}

// ─── TypeScript generation ───────────────────────────────────────────────────

/**
 * Generates a TypeScript file for a collection definition.
 */
export function generateCollectionFile(
   collectionName: string,
   schema: SchemaDescriptor,
   source: string,
): string {
   const interfaceName = `I${toPascalCase(collectionName)}`;
   const interfaceBody = generateInterface(schema, 1);
   const schemaBody = generateSchemaLiteral(schema, 1);

   return `// Generated by @vexnor/mongodb codegen — do not edit
import { collection } from '@vexnor/mongodb';

export interface ${interfaceName} {
${interfaceBody}
}

export const ${toPascalCase(collectionName)} = collection<${interfaceName}>('${collectionName}', {
  source: '${source}',
  schema: {
${schemaBody}
  },
});
`;
}

function generateInterface(schema: SchemaDescriptor, indent: number): string {
   const pad = "  ".repeat(indent);
   const lines: string[] = [];

   for (const [key, descriptor] of Object.entries(schema)) {
      const tsType = descriptorToTsType(descriptor);
      lines.push(`${pad}${key}: ${tsType};`);
   }

   return lines.join("\n");
}

function descriptorToTsType(descriptor: FieldDescriptor): string {
   if (typeof descriptor === "string") {
      switch (descriptor) {
         case "string":
            return "string";
         case "number":
         case "integer":
            return "number";
         case "boolean":
            return "boolean";
         case "date":
            return "Date";
      }
   }

   if (Array.isArray(descriptor)) {
      const itemDescriptor = descriptor[0];
      if (typeof itemDescriptor === "string") {
         return `${descriptorToTsType(itemDescriptor)}[]`;
      }
      // Array of objects
      const fields = Object.entries(itemDescriptor as SchemaDescriptor)
         .map(([k, v]) => `${k}: ${descriptorToTsType(v)}`)
         .join("; ");
      return `{ ${fields} }[]`;
   }

   // Nested object
   const fields = Object.entries(descriptor as SchemaDescriptor)
      .map(([k, v]) => `${k}: ${descriptorToTsType(v)}`)
      .join("; ");
   return `{ ${fields} }`;
}

function generateSchemaLiteral(schema: SchemaDescriptor, indent: number): string {
   const pad = "  ".repeat(indent + 1);
   const lines: string[] = [];

   for (const [key, descriptor] of Object.entries(schema)) {
      lines.push(`${pad}${key}: ${descriptorToSchemaValue(descriptor, indent + 1)},`);
   }

   return lines.join("\n");
}

function descriptorToSchemaValue(descriptor: FieldDescriptor, indent: number): string {
   if (typeof descriptor === "string") {
      return `'${descriptor}'`;
   }

   if (Array.isArray(descriptor)) {
      const itemDescriptor = descriptor[0];
      if (typeof itemDescriptor === "string") {
         return `['${itemDescriptor}']`;
      }
      // Array of objects
      const pad = "  ".repeat(indent + 1);
      const fields = Object.entries(itemDescriptor as SchemaDescriptor)
         .map(([k, v]) => `${pad}  ${k}: ${descriptorToSchemaValue(v, indent + 2)}`)
         .join(",\n");
      return `[{\n${fields},\n${pad}}]`;
   }

   // Nested object
   const pad = "  ".repeat(indent + 1);
   const fields = Object.entries(descriptor as SchemaDescriptor)
      .map(([k, v]) => `${pad}${k}: ${descriptorToSchemaValue(v, indent + 1)}`)
      .join(",\n");
   return `{\n${fields},\n${"  ".repeat(indent)}}`;
}

function toPascalCase(str: string): string {
   return str
      .replace(/[_-](.)/g, (_, c: string) => c.toUpperCase())
      .replace(/^(.)/, (_, c: string) => c.toUpperCase());
}

// ─── Full codegen runner ─────────────────────────────────────────────────────

export interface CodegenResult {
   collectionName: string;
   fileName: string;
   content: string;
   schema: SchemaDescriptor;
}

/**
 * Runs the full codegen pipeline for a MongoDB database.
 */
export async function runCodegen(db: Db, options: MongoCodegenOptions): Promise<CodegenResult[]> {
   const sampleSize = options.sampleSize ?? 1000;
   const source = options.source ?? `${options.database}:${options.outDir}`;

   // Get list of collections
   const allCollections = await db.listCollections().toArray();
   let collections = allCollections
      .filter((c) => c.type === "collection")
      .map((c) => c.name);

   // Apply include/exclude filters
   if (options.collections?.length) {
      const include = new Set(options.collections);
      collections = collections.filter((c) => include.has(c));
   }
   if (options.exclude?.length) {
      const exclude = new Set(options.exclude);
      collections = collections.filter((c) => !exclude.has(c));
   }

   const results: CodegenResult[] = [];

   for (const collectionName of collections) {
      // Try JSON Schema validator first
      const collInfo = allCollections.find((c) => c.name === collectionName);
      const validator = (collInfo as { options?: { validator?: { $jsonSchema?: JsonSchemaProperty } } })
         ?.options?.validator?.$jsonSchema;

      let schema: SchemaDescriptor;
      if (validator?.properties) {
         schema = jsonSchemaToDescriptor(validator);
      } else {
         // Fallback: document sampling
         const documents = await db
            .collection(collectionName)
            .find({})
            .limit(sampleSize)
            .toArray();
         schema = inferSchemaFromDocuments(documents);
      }

      const content = generateCollectionFile(collectionName, schema, source);
      const fileName = `${collectionName}.ts`;

      results.push({ collectionName, fileName, content, schema });
   }

   return results;
}
