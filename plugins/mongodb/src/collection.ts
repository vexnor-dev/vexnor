/**
 * MongoDB collection definition.
 *
 * Defines a typed collection with an explicit runtime schema descriptor.
 * Provides query construction methods: find, aggregate, deleteOne, insertOne, etc.
 */
import type { Document } from "mongodb";
import type { SchemaDescriptor } from "#src/schema-descriptor.js";
import type { MongoFilter, MongoFindOptions } from "#src/mongo-types.js";
import { MongoQuery } from "#src/mongo-query.js";

// ─── Collection options ──────────────────────────────────────────────────────

export interface CollectionOptions {
   /** Source identity — identifies which connection this collection belongs to */
   source: string;
   /** Runtime schema descriptor */
   schema: SchemaDescriptor;
}

// ─── Collection ref (for $lookup etc.) ───────────────────────────────────────

/** Symbol to identify collection refs at runtime */
export const COLLECTION_REF = Symbol.for("vexnor.mongodb.collection");

export interface MongoCollection<T extends Document = Document> {
   readonly [COLLECTION_REF]: true;
   /** The MongoDB collection name */
   readonly collectionName: string;
   /** Source identity */
   readonly source: string;
   /** Runtime schema descriptor */
   readonly schema: SchemaDescriptor;

   /**
    * Constructs a find query with an optional filter and options.
    */
   find(
      filter?: MongoFilter<T>,
      options?: MongoFindOptions<T>,
   ): MongoQuery<{ Row: T; Params: Record<string, unknown> }>;

   /**
    * Constructs an aggregation pipeline query.
    * Use an explicit type parameter for the result when the pipeline changes the shape.
    */
   aggregate<R extends Document = T>(
      pipeline: Document[],
   ): MongoQuery<{ Row: R; Params: Record<string, unknown> }>;

   /**
    * Constructs a deleteOne query.
    */
   deleteOne(
      filter: MongoFilter<T>,
   ): MongoQuery<{ Row: { deletedCount: number }; Params: Record<string, unknown> }>;

   /**
    * Constructs a deleteMany query.
    */
   deleteMany(
      filter: MongoFilter<T>,
   ): MongoQuery<{ Row: { deletedCount: number }; Params: Record<string, unknown> }>;

   /**
    * Constructs an insertOne query.
    * The param should provide the document to insert.
    */
   insertOne(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      doc: T | any,
   ): MongoQuery<{ Row: T; Params: Record<string, unknown> }>;

   /**
    * Constructs an insertMany query.
    */
   insertMany(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      docs: T[] | any,
   ): MongoQuery<{ Row: T; Params: Record<string, unknown> }>;

   /**
    * Constructs an updateOne query.
    */
   updateOne(
      filter: MongoFilter<T>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: Document | any,
   ): MongoQuery<{ Row: { matchedCount: number; modifiedCount: number }; Params: Record<string, unknown> }>;

   /**
    * Constructs an updateMany query.
    */
   updateMany(
      filter: MongoFilter<T>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: Document | any,
   ): MongoQuery<{ Row: { matchedCount: number; modifiedCount: number }; Params: Record<string, unknown> }>;
}

// ─── Type guard ──────────────────────────────────────────────────────────────

export function isMongoCollection(value: unknown): value is MongoCollection {
   return (
      typeof value === "object" &&
      value !== null &&
      COLLECTION_REF in value &&
      (value as MongoCollection)[COLLECTION_REF] === true
   );
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Defines a typed MongoDB collection with an explicit schema descriptor.
 *
 * @param name - The MongoDB collection name
 * @param options - Collection options (source identity, schema descriptor)
 *
 * @example
 * ```typescript
 * const orders = collection<Order>('orders', {
 *   source: '@myapp/api:events',
 *   schema: {
 *     _id: 'string',
 *     accountId: 'string',
 *     status: 'string',
 *     createdAt: 'date',
 *   },
 * });
 * ```
 */
export function collection<T extends Document>(name: string, options: CollectionOptions): MongoCollection<T> {
   const { source, schema } = options;

   const col: MongoCollection<T> = {
      [COLLECTION_REF]: true,
      collectionName: name,
      source,
      schema,

      find(filter?: MongoFilter<T>, findOptions?: MongoFindOptions<T>) {
         return MongoQuery.find<T>(col, filter, findOptions);
      },

      aggregate<R extends Document = T>(pipeline: Document[]) {
         return MongoQuery.aggregate<R>(col, pipeline);
      },

      deleteOne(filter: MongoFilter<T>) {
         return MongoQuery.deleteOne<T>(col, filter);
      },

      deleteMany(filter: MongoFilter<T>) {
         return MongoQuery.deleteMany<T>(col, filter);
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insertOne(doc: T | any) {
         return MongoQuery.insertOne<T>(col, doc);
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insertMany(docs: T[] | any) {
         return MongoQuery.insertMany<T>(col, docs);
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateOne(filter: MongoFilter<T>, update: Document | any) {
         return MongoQuery.updateOne<T>(col, filter, update);
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateMany(filter: MongoFilter<T>, update: Document | any) {
         return MongoQuery.updateMany<T>(col, filter, update);
      },
   };

   return col;
}
