/**
 * E2E tests for @vexnor/mongodb — requires a running MongoDB instance.
 *
 * These tests exercise the full execution path:
 * collection definition → query construction → param substitution → MongoDB driver execution.
 *
 * Skipped if MONGODB_URI is not set or MongoDB is unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MongoClient, type Db } from "mongodb";
import { param, ctx } from "@vexnor/core";
import { collection } from "#src/collection.js";
import { MongoQueryRegistry, serializeMongoManifest } from "#src/registry.js";
import { runCodegen } from "#src/codegen.js";
import { seedTestData, testAccounts, testOrders } from "./test-data-manager.js";
import type { TestAccount, TestOrder, TestProduct } from "./test-data-manager.js";

const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017";
const MONGODB_DATABASE = process.env.MONGODB_DATABASE ?? "vexnor_test";

// ─── Collection definitions ──────────────────────────────────────────────────

const accounts = collection<TestAccount>("accounts", {
   source: "@vexnor/mongodb-test:e2e",
   schema: {
      _id: "string",
      status: "string",
      email: "string",
      name: { first: "string", last: "string" },
      notes: "string",
      parent: { accountId: "string", email: "string" },
      createdAt: "date",
      modifiedAt: "date",
   },
});

const products = collection<TestProduct>("products", {
   source: "@vexnor/mongodb-test:e2e",
   schema: {
      _id: "string",
      label: "string",
      price: "number",
      discount: "number",
      availability: { isAvailable: "boolean", isPublished: "boolean" },
      metadata: {
         brand: "string",
         weight: "number",
         dimensions: { width: "number", height: "number", depth: "number" },
         colors: ["string"],
         countryOfOrigin: "string",
         releaseDate: "string",
         isRecyclable: "boolean",
      },
      tags: ["string"],
      createdAt: "date",
      modifiedAt: "date",
   },
});

const orders = collection<TestOrder>("orders", {
   source: "@vexnor/mongodb-test:e2e",
   schema: {
      _id: "string",
      status: "string",
      accountId: "string",
      items: [{
         productId: "string",
         label: "string",
         productPrice: "number",
         discountPrice: "number",
         quantity: "integer",
         metadata: {
            brand: "string",
            weight: "number",
            dimensions: { width: "number", height: "number", depth: "number" },
            colors: ["string"],
            countryOfOrigin: "string",
            releaseDate: "string",
            isRecyclable: "boolean",
         },
      }],
      createdAt: "date",
      modifiedAt: "date",
   },
});

// ─── Test setup ──────────────────────────────────────────────────────────────

let client: MongoClient;
let db: Db;
let isConnected = false;

beforeAll(async () => {
   try {
      client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 2000, connectTimeoutMS: 2000 });
      await client.connect();
      db = client.db(MONGODB_DATABASE);
      // Quick ping to verify connectivity
      await db.command({ ping: 1 });
      await seedTestData(db);
      isConnected = true;
   } catch {
      // MongoDB not available — tests will be skipped
      isConnected = false;
   }
}, 5000);

afterAll(async () => {
   if (client) {
      try {
         await client.close();
      } catch {
         // ignore
      }
   }
});

// ─── Helper to skip if no MongoDB ────────────────────────────────────────────

function skipIfNoMongo() {
   if (!isConnected) {
      return true;
   }
   return false;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("MongoDB E2E", () => {
   describe("find queries", () => {
      it("find all accounts", async () => {
         if (skipIfNoMongo()) return;

         const findAll = accounts.find({});
         const results = await findAll.all({ db });

         expect(results).toHaveLength(testAccounts.length);
      });

      it("find with literal filter", async () => {
         if (skipIfNoMongo()) return;

         const findConfirmed = accounts.find({ status: "confirmed" });
         const results = await findConfirmed.all({ db });

         expect(results).toHaveLength(2);
         expect(results.every((r) => r.status === "confirmed")).toBe(true);
      });

      it("find with param filter", async () => {
         if (skipIfNoMongo()) return;

         const statusParam = param<{ status: string }>("status");
         const findByStatus = accounts.find({ status: statusParam });
         const results = await findByStatus.all({ db, params: { status: "created" } });

         expect(results).toHaveLength(1);
         expect(results[0]!.email).toBe("charlie@example.com");
      });

      it("find with ctx filter", async () => {
         if (skipIfNoMongo()) return;

         const userIdCtx = ctx<{ userId: string }>("userId");
         const findById = accounts.find({ _id: userIdCtx });
         const result = await findById.one({ db, context: { userId: "acc-1" } });

         expect(result.email).toBe("alice@example.com");
      });

      it("find with sort and limit", async () => {
         if (skipIfNoMongo()) return;

         const limitParam = param<{ limit: number }>("limit");
         const findRecent = accounts.find({}, { sort: { createdAt: -1 }, limit: limitParam });
         const results = await findRecent.all({ db, params: { limit: 2 } });

         expect(results).toHaveLength(2);
         // Most recent first
         expect(results[0]!._id).toBe("acc-3");
      });

      it("find with projection", async () => {
         if (skipIfNoMongo()) return;

         const findEmails = accounts.find({}, { projection: { email: 1, _id: 0 } });
         const results = await findEmails.all({ db });

         expect(results).toHaveLength(testAccounts.length);
         // Should only have email field
         for (const r of results) {
            expect(r).toHaveProperty("email");
            expect(r).not.toHaveProperty("status");
         }
      });

      it(".one() returns single result", async () => {
         if (skipIfNoMongo()) return;

         const findOne = accounts.find({ _id: "acc-2" });
         const result = await findOne.one({ db });

         expect(result.email).toBe("bob@example.com");
      });

      it(".any() returns undefined for no results", async () => {
         if (skipIfNoMongo()) return;

         const findNone = accounts.find({ _id: "nonexistent" });
         const result = await findNone.any({ db });

         expect(result).toBeUndefined();
      });
   });

   describe("aggregate queries", () => {
      it("simple $match + $group", async () => {
         if (skipIfNoMongo()) return;

         const ordersByStatus = orders.aggregate<{ _id: string; count: number }>([
            { $group: { _id: "$status", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
         ]);
         const results = await ordersByStatus.all({ db });

         expect(results.length).toBeGreaterThan(0);
         // Check that we get status groups
         const statusIds = results.map((r) => r._id);
         expect(statusIds).toContain("delivered");
      });

      it("$match with param", async () => {
         if (skipIfNoMongo()) return;

         const statusParam = param<{ status: string }>("status");
         const findByStatus = orders.aggregate<TestOrder>([
            { $match: { status: statusParam } },
         ]);
         const results = await findByStatus.all({ db, params: { status: "delivered" } });

         expect(results).toHaveLength(1);
         expect(results[0]!._id).toBe("ord-1");
      });

      it("$lookup (cross-collection join)", async () => {
         if (skipIfNoMongo()) return;

         const ordersWithAccounts = orders.aggregate<TestOrder & { account: TestAccount[] }>([
            {
               $lookup: {
                  from: "accounts",
                  localField: "accountId",
                  foreignField: "_id",
                  as: "account",
               },
            },
         ]);
         const results = await ordersWithAccounts.all({ db });

         expect(results).toHaveLength(testOrders.length);
         // Each order should have an account array
         for (const r of results) {
            expect(r.account).toBeDefined();
            expect(r.account.length).toBeGreaterThan(0);
         }
      });

      it("$unwind (flatten arrays)", async () => {
         if (skipIfNoMongo()) return;

         const itemsFlat = orders.aggregate<{ accountId: string; item: { label: string; quantity: number } }>([
            { $unwind: "$items" },
            { $project: { accountId: 1, item: "$items" } },
         ]);
         const results = await itemsFlat.all({ db });

         // Total items across all orders
         const totalItems = testOrders.reduce((sum, o) => sum + o.items.length, 0);
         expect(results).toHaveLength(totalItems);
      });
   });

   describe("mutation queries", () => {
      it("insertOne + deleteOne", async () => {
         if (skipIfNoMongo()) return;

         const docParam = param<{ doc: TestAccount }>("doc");
         const insertAccount = accounts.insertOne(docParam);
         const newAccount: TestAccount = {
            _id: "acc-temp",
            status: "created",
            email: "temp@example.com",
            name: { first: "Temp", last: "User" },
            notes: null,
            parent: null,
            createdAt: new Date(),
            modifiedAt: new Date(),
         };

         await insertAccount.all({ db, params: { doc: newAccount } });

         // Verify it exists
         const findTemp = accounts.find({ _id: "acc-temp" });
         const found = await findTemp.any({ db });
         expect(found).toBeDefined();
         expect(found!.email).toBe("temp@example.com");

         // Clean up
         const idParam = param<{ id: string }>("id");
         const deleteTemp = accounts.deleteOne({ _id: idParam });
         const deleteResult = await deleteTemp.all({ db, params: { id: "acc-temp" } });
         expect(deleteResult[0]!.deletedCount).toBe(1);
      });

      it("updateOne", async () => {
         if (skipIfNoMongo()) return;

         const idParam = param<{ id: string }>("id");
         const updateNotes = accounts.updateOne(
            { _id: idParam },
            { $set: { notes: "updated by e2e test" } },
         );
         const result = await updateNotes.all({ db, params: { id: "acc-3" } });

         expect(result[0]!.matchedCount).toBe(1);
         expect(result[0]!.modifiedCount).toBe(1);

         // Verify
         const find = accounts.find({ _id: "acc-3" });
         const updated = await find.one({ db });
         expect(updated.notes).toBe("updated by e2e test");

         // Restore
         const restore = accounts.updateOne(
            { _id: idParam },
            { $set: { notes: null } },
         );
         await restore.all({ db, params: { id: "acc-3" } });
      });

      it("insertMany + deleteMany", async () => {
         if (skipIfNoMongo()) return;

         const docsParam = param<{ docs: TestAccount[] }>("docs");
         const insertMany = accounts.insertMany(docsParam);
         const newAccounts: TestAccount[] = [
            {
               _id: "acc-bulk-1",
               status: "created",
               email: "bulk1@example.com",
               name: { first: "Bulk", last: "One" },
               notes: null,
               parent: null,
               createdAt: new Date(),
               modifiedAt: new Date(),
            },
            {
               _id: "acc-bulk-2",
               status: "created",
               email: "bulk2@example.com",
               name: { first: "Bulk", last: "Two" },
               notes: null,
               parent: null,
               createdAt: new Date(),
               modifiedAt: new Date(),
            },
         ];

         await insertMany.all({ db, params: { docs: newAccounts } });

         // Verify both exist
         const findBulk = accounts.find({ _id: { $in: ["acc-bulk-1", "acc-bulk-2"] } });
         const found = await findBulk.all({ db });
         expect(found).toHaveLength(2);

         // deleteMany
         const deleteBulk = accounts.deleteMany({ _id: { $in: ["acc-bulk-1", "acc-bulk-2"] } });
         const deleteResult = await deleteBulk.all({ db });
         expect(deleteResult[0]!.deletedCount).toBe(2);
      });

      it("updateMany", async () => {
         if (skipIfNoMongo()) return;

         // Update all "confirmed" accounts' notes
         const updateMany = accounts.updateMany(
            { status: "confirmed" },
            { $set: { notes: "batch-updated" } },
         );
         const result = await updateMany.all({ db });

         expect(result[0]!.matchedCount).toBe(2); // acc-1 and acc-2
         expect(result[0]!.modifiedCount).toBeGreaterThanOrEqual(1);

         // Restore
         const restore = accounts.updateMany(
            { notes: "batch-updated" },
            { $set: { notes: null } },
         );
         await restore.all({ db });
      });
   });

   describe("registry integration", () => {
      it("register and execute queries via registry", async () => {
         if (skipIfNoMongo()) return;

         const registry = new MongoQueryRegistry();
         const statusParam = param<{ status: string }>("status");
         const findByStatus = accounts.find({ status: statusParam });
         const findAll = accounts.find({});

         await registry.register({ findByStatus, findAll });

         const hash = await findByStatus.hash;
         const results = await registry.execute<TestAccount[]>(
            { hash, params: { status: "confirmed" }, mode: "read" },
            db,
         );

         expect(results).toHaveLength(2);
      });

      it("manifest serialization", async () => {
         if (skipIfNoMongo()) return;

         const statusParam = param<{ status: string }>("status");
         const findByStatus = accounts.find({ status: statusParam });
         const findDelivered = orders.find({ status: "delivered" });

         const manifest = await serializeMongoManifest({ findByStatus, findDelivered });

         expect(manifest.version).toBe(1);
         expect(manifest.dialect).toBe("mongodb");
         expect(Object.keys(manifest.queries)).toHaveLength(2);
      });
   });

   describe("nested document patterns", () => {
      it("query nested object fields", async () => {
         if (skipIfNoMongo()) return;

         const findAvailable = products.find({ "availability.isAvailable": true });
         const results = await findAvailable.all({ db });

         expect(results).toHaveLength(2); // prod-1 and prod-2
      });

      it("query array elements with $elemMatch", async () => {
         if (skipIfNoMongo()) return;

         const findExpensiveItems = orders.aggregate<TestOrder>([
            { $match: { "items.productPrice": { $gte: 90 } } },
         ]);
         const results = await findExpensiveItems.all({ db });

         expect(results).toHaveLength(1);
         expect(results[0]!._id).toBe("ord-2");
      });

      it("query with $in operator", async () => {
         if (skipIfNoMongo()) return;

         const findMultipleStatuses = accounts.find({
            status: { $in: ["confirmed", "created"] },
         });
         const results = await findMultipleStatuses.all({ db });

         expect(results).toHaveLength(3); // acc-1, acc-2, acc-3
      });

      it("$lookup with typed collection ref", async () => {
         if (skipIfNoMongo()) return;

         // Use the collection object itself instead of a string in $lookup.from
         const ordersWithAccount = orders.aggregate<TestOrder & { account: TestAccount[] }>([
            { $lookup: { from: accounts, localField: "accountId", foreignField: "_id", as: "account" } },
         ]);
         const results = await ordersWithAccount.all({ db });

         expect(results).toHaveLength(testOrders.length);
         // Each order should have an account array resolved via the typed ref
         for (const r of results) {
            expect(r.account).toBeDefined();
            expect(r.account.length).toBeGreaterThan(0);
         }
      });

      it("$lookup with string collection name (both forms work)", async () => {
         if (skipIfNoMongo()) return;

         // Use a plain string in $lookup.from (traditional form)
         const ordersWithAccount = orders.aggregate<TestOrder & { account: TestAccount[] }>([
            { $lookup: { from: "accounts", localField: "accountId", foreignField: "_id", as: "account" } },
         ]);
         const results = await ordersWithAccount.all({ db });

         expect(results).toHaveLength(testOrders.length);
         for (const r of results) {
            expect(r.account.length).toBeGreaterThan(0);
         }
      });
   });

   describe("isomorphic execution", () => {
      it("executes via RemoteClient (mock)", async () => {
         if (skipIfNoMongo()) return;

         // Simulate the isomorphic pattern: same query, different db target
         const statusParam = param<{ status: string }>("status");
         const findByStatus = accounts.find({ status: statusParam });

         // Direct execution against Db
         const directResults = await findByStatus.all({ db, params: { status: "confirmed" } });
         expect(directResults).toHaveLength(2);

         // Remote execution via mock RemoteClient (simulates client-side)
         const mockRemoteClient = {
            remoteExecute: async () => directResults,
         };
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const remoteResults = await findByStatus.all({ db: mockRemoteClient as any, params: { status: "confirmed" } });
         expect(remoteResults).toStrictEqual(directResults);
      });
   });

   describe("hash determinism", () => {
      it("same query produces same hash across invocations", async () => {
         if (skipIfNoMongo()) return;

         const q1 = accounts.find({ status: "confirmed" }, { sort: { createdAt: -1 }, limit: 10 });
         const q2 = accounts.find({ status: "confirmed" }, { sort: { createdAt: -1 }, limit: 10 });

         const h1 = await q1.hash;
         const h2 = await q2.hash;
         expect(h1).toBe(h2);
      });

      it("different literal values produce different hashes", async () => {
         if (skipIfNoMongo()) return;

         const q1 = accounts.find({ status: "confirmed" });
         const q2 = accounts.find({ status: "deleted" });

         const h1 = await q1.hash;
         const h2 = await q2.hash;
         expect(h1).not.toBe(h2);
      });
   });

   describe("codegen", () => {
      it("generates collections from document sampling (no validator)", async () => {
         if (skipIfNoMongo()) return;

         // The seeded accounts/orders/products collections have no JSON Schema validator,
         // so codegen falls back to document sampling.
         const results = await runCodegen(db, {
            uri: MONGODB_URI,
            database: MONGODB_DATABASE,
            outDir: "src/generated",
            sampleSize: 100,
            collections: ["accounts"],
         });

         expect(results).toHaveLength(1);
         const accountsResult = results[0]!;
         expect(accountsResult.collectionName).toBe("accounts");
         expect(accountsResult.fileName).toBe("accounts.ts");

         // Schema should have inferred the fields from seeded documents
         expect(accountsResult.schema._id).toBe("string");
         expect(accountsResult.schema.email).toBe("string");
         expect(accountsResult.schema.status).toBe("string");
         expect(accountsResult.schema.createdAt).toBe("date");

         // Nested object inferred
         expect(accountsResult.schema.name).toMatchObject({ first: "string", last: "string" });

         // Generated content should be valid TypeScript
         expect(accountsResult.content).toContain("import { collection } from '@vexnor/mongodb'");
         expect(accountsResult.content).toContain("export interface IAccounts");
         expect(accountsResult.content).toContain("export const Accounts = collection<IAccounts>('accounts'");
      });

      it("generates collections from JSON Schema validator", async () => {
         if (skipIfNoMongo()) return;

         // Create a collection with a JSON Schema validator
         const validatedCollName = "codegen_test_validated";
         try {
            await db.dropCollection(validatedCollName);
         } catch {
            // ignore — may not exist
         }

         await db.createCollection(validatedCollName, {
            validator: {
               $jsonSchema: {
                  bsonType: "object",
                  required: ["name", "email", "age"],
                  properties: {
                     _id: { bsonType: "objectId" },
                     name: { bsonType: "string" },
                     email: { bsonType: "string" },
                     age: { bsonType: "int" },
                     score: { bsonType: "double" },
                     active: { bsonType: "bool" },
                     createdAt: { bsonType: "date" },
                     tags: { bsonType: "array", items: { bsonType: "string" } },
                     address: {
                        bsonType: "object",
                        properties: {
                           street: { bsonType: "string" },
                           city: { bsonType: "string" },
                           zip: { bsonType: "string" },
                        },
                     },
                  },
               },
            },
         });

         // Insert a document so the collection exists and has data
         await db.collection(validatedCollName).insertOne({
            name: "Test",
            email: "test@example.com",
            age: 25,
            score: 95.5,
            active: true,
            createdAt: new Date(),
            tags: ["a", "b"],
            address: { street: "123 Main", city: "NYC", zip: "10001" },
         });

         const results = await runCodegen(db, {
            uri: MONGODB_URI,
            database: MONGODB_DATABASE,
            outDir: "src/generated",
            collections: [validatedCollName],
         });

         expect(results).toHaveLength(1);
         const result = results[0]!;
         expect(result.collectionName).toBe(validatedCollName);

         // Schema should come from the JSON Schema validator, not sampling
         expect(result.schema._id).toBe("string"); // objectId → string
         expect(result.schema.name).toBe("string");
         expect(result.schema.email).toBe("string");
         expect(result.schema.age).toBe("integer"); // int → integer
         expect(result.schema.score).toBe("number"); // double → number
         expect(result.schema.active).toBe("boolean");
         expect(result.schema.createdAt).toBe("date");
         expect(result.schema.tags).toStrictEqual(["string"]);
         expect(result.schema.address).toMatchObject({
            street: "string",
            city: "string",
            zip: "string",
         });

         // Generated content should reference the collection
         expect(result.content).toContain("export interface ICodegenTestValidated");
         expect(result.content).toContain(`collection<ICodegenTestValidated>('${validatedCollName}'`);

         // Cleanup
         await db.dropCollection(validatedCollName);
      });

      it("respects include/exclude filters", async () => {
         if (skipIfNoMongo()) return;

         // Include only orders
         const included = await runCodegen(db, {
            uri: MONGODB_URI,
            database: MONGODB_DATABASE,
            outDir: "src/generated",
            collections: ["orders"],
         });
         expect(included).toHaveLength(1);
         expect(included[0]!.collectionName).toBe("orders");

         // Exclude accounts
         const excluded = await runCodegen(db, {
            uri: MONGODB_URI,
            database: MONGODB_DATABASE,
            outDir: "src/generated",
            exclude: ["accounts"],
         });
         expect(excluded.find((r) => r.collectionName === "accounts")).toBeUndefined();
         expect(excluded.length).toBeGreaterThan(0);
      });

      it("infers array-of-objects schema from orders.items", async () => {
         if (skipIfNoMongo()) return;

         const results = await runCodegen(db, {
            uri: MONGODB_URI,
            database: MONGODB_DATABASE,
            outDir: "src/generated",
            collections: ["orders"],
         });

         const ordersResult = results[0]!;
         expect(ordersResult.schema.items).toBeDefined();

         // items should be an array-of-objects descriptor: [{ productId: 'string', ... }]
         const itemsSchema = ordersResult.schema.items;
         expect(Array.isArray(itemsSchema)).toBe(true);
         const itemObj = (itemsSchema as [Record<string, unknown>])[0]!;
         expect(itemObj.productId).toBe("string");
         expect(itemObj.label).toBe("string");
         expect(itemObj.quantity).toBe("number");
      });
   });
});
