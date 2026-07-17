/**
 * VexnorMongoDB plugin — integrates MongoDB with the SqlQueryRegistry.
 *
 * This is a minimal plugin implementation that enables registry integration.
 * Unlike SQL plugins, MongoDB doesn't need dialect-specific SQL generation,
 * so many methods are stubs or throw "not applicable."
 */
import type { Db, MongoClient } from "mongodb";
import { MONGODB_PLUGIN_NAME } from "#src/mongo-query.js";

export interface MongoConnectionConfig {
   uri: string;
   database: string;
}

/**
 * Lightweight plugin descriptor for registry integration.
 * MongoDB doesn't extend VexnorPlugin (which is SQL-specific) — instead
 * it provides the minimal interface needed by SqlQueryRegistry.register().
 */
export class VexnorMongoDB {
   readonly name = MONGODB_PLUGIN_NAME;
   readonly driver = "mongodb";
   readonly dialect = "mongodb";

   private _client: MongoClient | null = null;
   private _db: Db | null = null;

   /**
    * Creates a connected database instance from a URI.
    * The caller is responsible for closing via close().
    */
   async connect(config: MongoConnectionConfig): Promise<Db> {
      const { MongoClient: MC } = await import("mongodb");
      this._client = new MC(config.uri);
      await this._client.connect();
      this._db = this._client.db(config.database);
      return this._db;
   }

   /**
    * Creates a Db instance from an existing MongoClient.
    */
   fromClient(client: MongoClient, database: string): Db {
      this._client = client;
      this._db = client.db(database);
      return this._db;
   }

   /**
    * Closes the underlying MongoClient connection.
    */
   async close(): Promise<void> {
      if (this._client) {
         await this._client.close();
         this._client = null;
         this._db = null;
      }
   }

   /** Gets the current database instance. */
   get db(): Db | null {
      return this._db;
   }
}

export const vexnorMongodb = new VexnorMongoDB();
