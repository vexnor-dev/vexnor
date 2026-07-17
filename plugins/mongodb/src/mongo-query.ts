/**
 * MongoQuery — the core query object for MongoDB operations.
 *
 * A MongoQuery represents a single MongoDB operation (find, aggregate, delete, insert, update)
 * with statically declared parameters. It carries:
 * - The operation descriptor (for hashing and cross-runtime manifest export)
 * - Extracted param/ctx declarations
 * - The result row schema
 * - Execution methods (.all(), .one(), .any())
 */
import type { Document, Db, Collection as MongoDriverCollection } from "mongodb";
import type { MongoFilter, MongoFindOptions, MongoOperation, MongoParamInfo } from "#src/mongo-types.js";
import type { MongoCollection } from "#src/collection.js";
import type { SchemaDescriptor } from "#src/schema-descriptor.js";
import { walkFilter, walkFindOptions, walkPipeline, walkValue, substituteParams } from "#src/walk-params.js";
import { canonicalJson } from "#src/canonical-json.js";
import { RemoteClient, isRemoteClient } from "@vexnor/core";

// ─── Lazy hash helper ────────────────────────────────────────────────────────

class Lazy<T> {
   private _value: T | undefined;
   private _computed = false;
   constructor(private readonly _fn: () => T) {}
   get value(): T {
      if (!this._computed) {
         this._value = this._fn();
         this._computed = true;
      }
      return this._value as T;
   }
}

// ─── Plugin name ─────────────────────────────────────────────────────────────

export const MONGODB_PLUGIN_NAME = "@vexnor/mongodb";

// ─── Execution args ──────────────────────────────────────────────────────────

export interface MongoExecutionArgs<TParams = Record<string, unknown>> {
   /** MongoDB client (Db instance) or a remote client for isomorphic execution */
   db: Db | RemoteClient | Promise<Db | RemoteClient>;
   /** Runtime parameter values */
   params?: TParams;
   /** Server-side context values (for ctx() params) */
   context?: Record<string, unknown>;
}

// ─── MongoQuery class ────────────────────────────────────────────────────────

export class MongoQuery<T extends { Row?: unknown; Params?: unknown }> {
   /** Collection name */
   readonly collectionName: string;
   /** Operation type */
   readonly operation: MongoOperation;
   /** Source identity */
   readonly source: string;
   /** Schema descriptor for the result row */
   readonly rowSchema: SchemaDescriptor;
   /** Extracted parameters */
   readonly params: Record<string, MongoParamInfo>;
   /** Authorization tags */
   private _authorization: string[] = [];

   /** The operation descriptor with $param/$literal/$ctx markers */
   private readonly _descriptor: Record<string, unknown>;
   /** Lazy-computed hash */
   private readonly _hashLazy: Lazy<Promise<string>>;

   private constructor(args: {
      collectionName: string;
      operation: MongoOperation;
      source: string;
      rowSchema: SchemaDescriptor;
      params: Record<string, MongoParamInfo>;
      descriptor: Record<string, unknown>;
   }) {
      this.collectionName = args.collectionName;
      this.operation = args.operation;
      this.source = args.source;
      this.rowSchema = args.rowSchema;
      this.params = args.params;
      this._descriptor = args.descriptor;
      this._hashLazy = new Lazy(() => this.computeHash());
   }

   /** The serialized operation descriptor */
   get descriptor(): Record<string, unknown> {
      return this._descriptor;
   }

   /** Authorization tags */
   get authorization(): string[] {
      return this._authorization;
   }

   /** Stable SHA-256 hash of this query's operation descriptor */
   get hash(): Promise<string> {
      return this._hashLazy.value;
   }

   /**
    * Tags this query with an authorization label.
    */
   authorize(...tags: string[]): this {
      const clone = Object.create(this) as this;
      clone._authorization = [...this._authorization, ...tags];
      return clone;
   }

   // ─── Static factory methods ────────────────────────────────────────────────

   static find<T extends Document>(
      col: MongoCollection<T>,
      filter?: MongoFilter<T>,
      options?: MongoFindOptions<T>,
   ): MongoQuery<{ Row: T; Params: Record<string, unknown> }> {
      const params: Record<string, MongoParamInfo> = {};

      const filterDescriptor = walkFilter(filter ?? {}, params);
      const optionsDescriptor = walkFindOptions(
         options as Record<string, unknown> | undefined,
         params,
      );

      const descriptor: Record<string, unknown> = {
         collection: col.collectionName,
         operation: "find",
         filter: filterDescriptor,
      };
      if (optionsDescriptor) {
         // Merge options fields into descriptor
         for (const [key, val] of Object.entries(optionsDescriptor)) {
            if (val !== undefined && val !== null) {
               descriptor[key] = val;
            }
         }
      }

      return new MongoQuery({
         collectionName: col.collectionName,
         operation: "find",
         source: col.source,
         rowSchema: col.schema,
         params,
         descriptor,
      });
   }

   static aggregate<R extends Document>(
      col: MongoCollection,
      pipeline: Document[],
   ): MongoQuery<{ Row: R; Params: Record<string, unknown> }> {
      const params: Record<string, MongoParamInfo> = {};
      const pipelineDescriptor = walkPipeline(pipeline, params);

      const descriptor: Record<string, unknown> = {
         collection: col.collectionName,
         operation: "aggregate",
         pipeline: pipelineDescriptor,
      };

      return new MongoQuery({
         collectionName: col.collectionName,
         operation: "aggregate",
         source: col.source,
         rowSchema: col.schema,
         params,
         descriptor,
      });
   }

   static deleteOne<T extends Document>(
      col: MongoCollection<T>,
      filter: MongoFilter<T>,
   ): MongoQuery<{ Row: { deletedCount: number }; Params: Record<string, unknown> }> {
      const params: Record<string, MongoParamInfo> = {};
      const filterDescriptor = walkFilter(filter, params);

      const descriptor: Record<string, unknown> = {
         collection: col.collectionName,
         operation: "deleteOne",
         filter: filterDescriptor,
      };

      return new MongoQuery({
         collectionName: col.collectionName,
         operation: "deleteOne",
         source: col.source,
         rowSchema: { deletedCount: "integer" },
         params,
         descriptor,
      });
   }

   static deleteMany<T extends Document>(
      col: MongoCollection<T>,
      filter: MongoFilter<T>,
   ): MongoQuery<{ Row: { deletedCount: number }; Params: Record<string, unknown> }> {
      const params: Record<string, MongoParamInfo> = {};
      const filterDescriptor = walkFilter(filter, params);

      const descriptor: Record<string, unknown> = {
         collection: col.collectionName,
         operation: "deleteMany",
         filter: filterDescriptor,
      };

      return new MongoQuery({
         collectionName: col.collectionName,
         operation: "deleteMany",
         source: col.source,
         rowSchema: { deletedCount: "integer" },
         params,
         descriptor,
      });
   }

   static insertOne<T extends Document>(
      col: MongoCollection<T>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      doc: T | any,
   ): MongoQuery<{ Row: T; Params: Record<string, unknown> }> {
      const params: Record<string, MongoParamInfo> = {};
      const docDescriptor = walkValue(doc, params, true);

      const descriptor: Record<string, unknown> = {
         collection: col.collectionName,
         operation: "insertOne",
         document: docDescriptor,
      };

      return new MongoQuery({
         collectionName: col.collectionName,
         operation: "insertOne",
         source: col.source,
         rowSchema: col.schema,
         params,
         descriptor,
      });
   }

   static insertMany<T extends Document>(
      col: MongoCollection<T>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      docs: T[] | any,
   ): MongoQuery<{ Row: T; Params: Record<string, unknown> }> {
      const params: Record<string, MongoParamInfo> = {};
      const docsDescriptor = walkValue(docs, params, true);

      const descriptor: Record<string, unknown> = {
         collection: col.collectionName,
         operation: "insertMany",
         documents: docsDescriptor,
      };

      return new MongoQuery({
         collectionName: col.collectionName,
         operation: "insertMany",
         source: col.source,
         rowSchema: col.schema,
         params,
         descriptor,
      });
   }

   static updateOne<T extends Document>(
      col: MongoCollection<T>,
      filter: MongoFilter<T>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: Document | any,
   ): MongoQuery<{ Row: { matchedCount: number; modifiedCount: number }; Params: Record<string, unknown> }> {
      const params: Record<string, MongoParamInfo> = {};
      const filterDescriptor = walkFilter(filter, params);
      const updateDescriptor = walkFilter(update, params);

      const descriptor: Record<string, unknown> = {
         collection: col.collectionName,
         operation: "updateOne",
         filter: filterDescriptor,
         update: updateDescriptor,
      };

      return new MongoQuery({
         collectionName: col.collectionName,
         operation: "updateOne",
         source: col.source,
         rowSchema: { matchedCount: "integer", modifiedCount: "integer" },
         params,
         descriptor,
      });
   }

   static updateMany<T extends Document>(
      col: MongoCollection<T>,
      filter: MongoFilter<T>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: Document | any,
   ): MongoQuery<{ Row: { matchedCount: number; modifiedCount: number }; Params: Record<string, unknown> }> {
      const params: Record<string, MongoParamInfo> = {};
      const filterDescriptor = walkFilter(filter, params);
      const updateDescriptor = walkFilter(update, params);

      const descriptor: Record<string, unknown> = {
         collection: col.collectionName,
         operation: "updateMany",
         filter: filterDescriptor,
         update: updateDescriptor,
      };

      return new MongoQuery({
         collectionName: col.collectionName,
         operation: "updateMany",
         source: col.source,
         rowSchema: { matchedCount: "integer", modifiedCount: "integer" },
         params,
         descriptor,
      });
   }

   // ─── Execution methods ─────────────────────────────────────────────────────

   /**
    * Executes the query and returns all result rows.
    */
   async all(args: MongoExecutionArgs<T["Params"]>): Promise<T["Row"][]> {
      const db = await args.db;
      const runtimeParams = this.mergeParams(args);

      if (isRemoteClient(db)) {
         return this.executeRemote(db, runtimeParams, "read");
      }

      return this.executeLocal(db as Db, runtimeParams);
   }

   /**
    * Executes the query and returns exactly one row. Throws if not exactly one.
    */
   async one(args: MongoExecutionArgs<T["Params"]>): Promise<T["Row"]> {
      const results = await this.all(args);
      if (results.length !== 1) {
         throw new Error(`Expected one result, got ${results.length}`);
      }
      return results[0]!;
   }

   /**
    * Executes the query and returns the first row, or undefined if none.
    */
   async any(args: MongoExecutionArgs<T["Params"]>): Promise<T["Row"] | undefined> {
      const results = await this.all(args);
      return results[0];
   }

   // ─── Private ───────────────────────────────────────────────────────────────

   private mergeParams(args: MongoExecutionArgs<T["Params"]>): Record<string, unknown> {
      const userParams = (args.params ?? {}) as Record<string, unknown>;
      const contextParams = args.context ?? {};

      // Merge user params and context params
      const merged: Record<string, unknown> = { ...userParams };
      for (const [key, info] of Object.entries(this.params)) {
         if (info.isContext) {
            merged[key] = contextParams[key];
         }
      }
      return merged;
   }

   private async executeRemote(
      client: RemoteClient,
      runtimeParams: Record<string, unknown>,
      mode: "read" | "write",
   ): Promise<T["Row"][]> {
      const hash = await this.hash;
      // Strip context values — they're injected server-side
      const params = Object.fromEntries(
         Object.entries(runtimeParams).filter(([key]) => !this.params[key]?.isContext),
      );

      const result = await client.remoteExecute({
         plugin: MONGODB_PLUGIN_NAME,
         hash,
         params,
         name: null,
         location: null,
         mode,
      });

      return result as T["Row"][];
   }

   private async executeLocal(db: Db, runtimeParams: Record<string, unknown>): Promise<T["Row"][]> {
      const coll: MongoDriverCollection = db.collection(this.collectionName);

      // Substitute params in descriptor to get the concrete operation
      const resolvedDescriptor = substituteParams(this._descriptor, runtimeParams) as Record<string, unknown>;

      switch (this.operation) {
         case "find": {
            const filter = (resolvedDescriptor.filter ?? {}) as Document;
            const sort = resolvedDescriptor.sort as Document | undefined;
            const limit = resolvedDescriptor.limit as number | undefined;
            const skip = resolvedDescriptor.skip as number | undefined;
            const projection = resolvedDescriptor.projection as Document | undefined;

            let cursor = coll.find(filter);
            if (projection) cursor = cursor.project(projection);
            if (sort) cursor = cursor.sort(sort);
            if (skip) cursor = cursor.skip(skip);
            if (limit) cursor = cursor.limit(limit);

            return (await cursor.toArray()) as T["Row"][];
         }

         case "aggregate": {
            const pipeline = (resolvedDescriptor.pipeline ?? []) as Document[];
            const cursor = coll.aggregate(pipeline);
            return (await cursor.toArray()) as T["Row"][];
         }

         case "deleteOne": {
            const filter = (resolvedDescriptor.filter ?? {}) as Document;
            const result = await coll.deleteOne(filter);
            return [{ deletedCount: result.deletedCount }] as T["Row"][];
         }

         case "deleteMany": {
            const filter = (resolvedDescriptor.filter ?? {}) as Document;
            const result = await coll.deleteMany(filter);
            return [{ deletedCount: result.deletedCount }] as T["Row"][];
         }

         case "insertOne": {
            const document = resolvedDescriptor.document as Document;
            await coll.insertOne(document);
            return [document] as T["Row"][];
         }

         case "insertMany": {
            const documents = resolvedDescriptor.documents as Document[];
            await coll.insertMany(documents);
            return documents as T["Row"][];
         }

         case "updateOne": {
            const filter = (resolvedDescriptor.filter ?? {}) as Document;
            const update = resolvedDescriptor.update as Document;
            const result = await coll.updateOne(filter, update);
            return [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }] as T["Row"][];
         }

         case "updateMany": {
            const filter = (resolvedDescriptor.filter ?? {}) as Document;
            const update = resolvedDescriptor.update as Document;
            const result = await coll.updateMany(filter, update);
            return [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }] as T["Row"][];
         }

         default:
            throw new Error(`Unsupported MongoDB operation: ${this.operation}`);
      }
   }

   private async computeHash(): Promise<string> {
      const input = canonicalJson(this._descriptor);
      const encoded = new TextEncoder().encode(input);
      const buf = await crypto.subtle.digest("SHA-256", encoded);
      return Array.from(new Uint8Array(buf))
         .map((b) => b.toString(16).padStart(2, "0"))
         .join("");
   }
}
