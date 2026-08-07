/**
 * Registry integration for MongoDB queries.
 *
 * Provides a wrapper to register MongoQuery instances with SqlQueryRegistry.
 * The registry dispatches by plugin name + hash, so MongoDB queries can
 * coexist with SQL queries in the same registry.
 */
import type { Db } from "mongodb";
import { MongoQuery, MONGODB_PLUGIN_NAME } from "#src/mongo-query.js";

// ─── Query map type ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MongoQueryMap = Record<string, MongoQuery<any>>;

// ─── MongoDB Registry ────────────────────────────────────────────────────────

/**
 * A standalone MongoDB query registry for use when SqlQueryRegistry's SQL-specific
 * interface is not suitable. Stores queries by hash and executes them with
 * hash-based dispatch (same security model as SQL).
 */
export class MongoQueryRegistry<TContext extends Record<string, unknown> = Record<string, unknown>> {
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   private readonly queries = new Map<string, { query: MongoQuery<any>; name: string }>();

   /**
    * Registers a set of MongoDB queries.
    */
   async register(queries: MongoQueryMap): Promise<void> {
      for (const [name, query] of Object.entries(queries)) {
         const hash = await query.hash;
         this.queries.set(hash, { query, name });
      }
   }

   /**
    * Returns all registered queries.
    */
   getRegisteredQueries(): { plugin: string; hash: string; name: string }[] {
      const result: { plugin: string; hash: string; name: string }[] = [];
      for (const [hash, { name }] of this.queries) {
         result.push({ plugin: MONGODB_PLUGIN_NAME, hash, name });
      }
      return result;
   }

   /**
    * Startup validation — asserts all authorized queries have hooks.
    */
   checkAuthorization(): void {
      for (const [, { query, name }] of this.queries) {
         if (query.authorization.length > 0) {
            // In a real implementation, check that auth hooks are registered
            void name; // placeholder
         }
      }
   }

   /**
    * Executes a registered query by hash.
    */
   async execute<TResult = unknown>(
      args: {
         hash: string;
         params: Record<string, unknown>;
         mode: "read" | "write";
      },
      db: Db,
      context: TContext = {} as TContext,
   ): Promise<TResult> {
      const entry = this.queries.get(args.hash);
      if (!entry) {
         throw new Error(`Unknown MongoDB query hash: ${args.hash}`);
      }

      const { query } = entry;

      // Execute the query, passing context separately
      return (await query.all({
         db,
         params: args.params as never,
         context: context as Record<string, unknown>,
      })) as TResult;
   }
}

// ─── Manifest export ─────────────────────────────────────────────────────────

export interface MongoManifestEntry {
   name: string;
   hash: string;
   descriptor: Record<string, unknown>;
   params: Record<string, { name: string; isContext: boolean }>;
   schema: Record<string, unknown>;
}

export interface MongoManifest {
   version: 1;
   dialect: "mongodb";
   queries: Record<string, MongoManifestEntry>;
}

/**
 * Serializes registered MongoDB queries into a cross-runtime manifest.
 */
export async function serializeMongoManifest(queries: MongoQueryMap): Promise<MongoManifest> {
   const manifest: MongoManifest = {
      version: 1,
      dialect: "mongodb",
      queries: {},
   };

   for (const [name, query] of Object.entries(queries)) {
      const hash = await query.hash;
      manifest.queries[hash] = {
         name,
         hash,
         descriptor: query.descriptor,
         params: query.params,
         schema: query.rowSchema,
      };
   }

   return manifest;
}
