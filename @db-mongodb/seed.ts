/**
 * MongoDB seed script — populates the local MongoDB with realistic demo data.
 *
 * Run: npx tsx @db-mongodb/seed.ts
 *
 * Mirrors the same entities (accounts, products, orders) used in the Postgres
 * examples but modeled the MongoDB way — nested documents, embedded arrays,
 * denormalized data.
 */
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017";
const MONGODB_DATABASE = process.env.MONGODB_DATABASE ?? "vexnor";

// ─── Dates ───────────────────────────────────────────────────────────────────

const now = new Date("2024-06-15T12:00:00.000Z");
const oneHourAgo = new Date("2024-06-15T11:00:00.000Z");
const oneDayAgo = new Date("2024-06-14T12:00:00.000Z");
const twoDaysAgo = new Date("2024-06-13T12:00:00.000Z");
const oneWeekAgo = new Date("2024-06-08T12:00:00.000Z");
const twoWeeksAgo = new Date("2024-06-01T12:00:00.000Z");

// ─── Accounts ────────────────────────────────────────────────────────────────

const accounts = [
   {
      _id: "acc-001",
      status: "confirmed",
      email: "alice.smith@example.com",
      name: { first: "Alice", last: "Smith" },
      notes: "VIP customer — enterprise plan",
      parent: null,
      createdAt: twoWeeksAgo,
      modifiedAt: oneDayAgo,
   },
   {
      _id: "acc-002",
      status: "confirmed",
      email: "bob.jones@example.com",
      name: { first: "Bob", last: "Jones" },
      notes: null,
      parent: { accountId: "acc-001", email: "alice.smith@example.com" },
      createdAt: oneWeekAgo,
      modifiedAt: twoDaysAgo,
   },
   {
      _id: "acc-003",
      status: "confirmed",
      email: "charlie.brown@example.com",
      name: { first: "Charlie", last: "Brown" },
      notes: "Referred by Bob",
      parent: { accountId: "acc-002", email: "bob.jones@example.com" },
      createdAt: twoDaysAgo,
      modifiedAt: oneHourAgo,
   },
   {
      _id: "acc-004",
      status: "created",
      email: "diana.prince@example.com",
      name: { first: "Diana", last: "Prince" },
      notes: null,
      parent: null,
      createdAt: oneDayAgo,
      modifiedAt: oneDayAgo,
   },
   {
      _id: "acc-005",
      status: "created",
      email: "eve.wilson@example.com",
      name: { first: "Eve", last: "Wilson" },
      notes: "Pending email verification",
      parent: null,
      createdAt: oneHourAgo,
      modifiedAt: oneHourAgo,
   },
   {
      _id: "acc-006",
      status: "deleted",
      email: "frank.deleted@example.com",
      name: { first: "Frank", last: "Miller" },
      notes: "Account closed by user request",
      parent: null,
      createdAt: twoWeeksAgo,
      modifiedAt: now,
   },
];

// ─── Products ────────────────────────────────────────────────────────────────

const products = [
   {
      _id: "prod-001",
      label: "Widget Pro X1",
      price: 29.99,
      discount: 5.0,
      availability: { isAvailable: true, isPublished: true },
      metadata: {
         brand: "WidgetCo",
         weight: 0.45,
         dimensions: { width: 12, height: 8, depth: 3 },
         colors: ["midnight-blue", "silver", "rose-gold"],
         countryOfOrigin: "US",
         releaseDate: "2024-01-15",
         isRecyclable: true,
      },
      tags: ["electronics", "gadgets", "best-seller"],
      createdAt: twoWeeksAgo,
      modifiedAt: oneDayAgo,
   },
   {
      _id: "prod-002",
      label: "Basic Widget",
      price: 9.99,
      discount: null,
      availability: { isAvailable: true, isPublished: true },
      metadata: null,
      tags: ["basics", "starter"],
      createdAt: oneWeekAgo,
      modifiedAt: oneWeekAgo,
   },
   {
      _id: "prod-003",
      label: "Premium Widget Ultra",
      price: 99.99,
      discount: 15.0,
      availability: { isAvailable: true, isPublished: true },
      metadata: {
         brand: "PremiumCo",
         weight: 1.2,
         dimensions: { width: 20, height: 10, depth: 8 },
         colors: ["gold", "platinum"],
         countryOfOrigin: "DE",
         releaseDate: "2024-03-01",
         isRecyclable: false,
      },
      tags: ["premium", "electronics", "luxury"],
      createdAt: twoDaysAgo,
      modifiedAt: twoDaysAgo,
   },
   {
      _id: "prod-004",
      label: "Widget Nano",
      price: 4.99,
      discount: 1.0,
      availability: { isAvailable: true, isPublished: true },
      metadata: {
         brand: "WidgetCo",
         weight: 0.1,
         dimensions: { width: 3, height: 3, depth: 1 },
         colors: ["white", "black"],
         countryOfOrigin: "CN",
         releaseDate: "2024-05-10",
         isRecyclable: true,
      },
      tags: ["electronics", "mini", "budget"],
      createdAt: oneDayAgo,
      modifiedAt: oneDayAgo,
   },
   {
      _id: "prod-005",
      label: "Widget Enterprise Suite",
      price: 499.99,
      discount: 50.0,
      availability: { isAvailable: false, isPublished: false },
      metadata: {
         brand: "WidgetCo",
         weight: 5.0,
         dimensions: { width: 40, height: 30, depth: 15 },
         colors: ["matte-black"],
         countryOfOrigin: "US",
         releaseDate: "2024-08-01",
         isRecyclable: true,
      },
      tags: ["enterprise", "premium", "coming-soon"],
      createdAt: now,
      modifiedAt: now,
   },
];

// ─── Orders (with embedded items — denormalized, MongoDB-style) ──────────────

const orders = [
   {
      _id: "ord-001",
      status: "delivered",
      accountId: "acc-001",
      items: [
         {
            productId: "prod-001",
            label: "Widget Pro X1",
            productPrice: 29.99,
            discountPrice: 24.99,
            quantity: 3,
            metadata: products[0]!.metadata,
         },
         {
            productId: "prod-002",
            label: "Basic Widget",
            productPrice: 9.99,
            discountPrice: null,
            quantity: 10,
            metadata: null,
         },
      ],
      createdAt: oneWeekAgo,
      modifiedAt: twoDaysAgo,
   },
   {
      _id: "ord-002",
      status: "delivered",
      accountId: "acc-001",
      items: [
         {
            productId: "prod-003",
            label: "Premium Widget Ultra",
            productPrice: 99.99,
            discountPrice: 84.99,
            quantity: 1,
            metadata: products[2]!.metadata,
         },
      ],
      createdAt: twoDaysAgo,
      modifiedAt: oneDayAgo,
   },
   {
      _id: "ord-003",
      status: "paid",
      accountId: "acc-002",
      items: [
         {
            productId: "prod-001",
            label: "Widget Pro X1",
            productPrice: 29.99,
            discountPrice: 24.99,
            quantity: 2,
            metadata: products[0]!.metadata,
         },
         {
            productId: "prod-004",
            label: "Widget Nano",
            productPrice: 4.99,
            discountPrice: 3.99,
            quantity: 5,
            metadata: products[3]!.metadata,
         },
      ],
      createdAt: oneDayAgo,
      modifiedAt: oneHourAgo,
   },
   {
      _id: "ord-004",
      status: "created",
      accountId: "acc-003",
      items: [
         {
            productId: "prod-003",
            label: "Premium Widget Ultra",
            productPrice: 99.99,
            discountPrice: 84.99,
            quantity: 2,
            metadata: products[2]!.metadata,
         },
         {
            productId: "prod-001",
            label: "Widget Pro X1",
            productPrice: 29.99,
            discountPrice: 24.99,
            quantity: 1,
            metadata: products[0]!.metadata,
         },
         {
            productId: "prod-004",
            label: "Widget Nano",
            productPrice: 4.99,
            discountPrice: 3.99,
            quantity: 10,
            metadata: products[3]!.metadata,
         },
      ],
      createdAt: oneHourAgo,
      modifiedAt: oneHourAgo,
   },
   {
      _id: "ord-005",
      status: "received",
      accountId: "acc-002",
      items: [
         {
            productId: "prod-002",
            label: "Basic Widget",
            productPrice: 9.99,
            discountPrice: null,
            quantity: 20,
            metadata: null,
         },
      ],
      createdAt: twoWeeksAgo,
      modifiedAt: oneWeekAgo,
   },
   {
      _id: "ord-006",
      status: "paid",
      accountId: "acc-004",
      items: [
         {
            productId: "prod-001",
            label: "Widget Pro X1",
            productPrice: 29.99,
            discountPrice: 24.99,
            quantity: 1,
            metadata: products[0]!.metadata,
         },
      ],
      createdAt: now,
      modifiedAt: now,
   },
];

// ─── Seed ────────────────────────────────────────────────────────────────────

async function seed() {
   const client = new MongoClient(MONGODB_URI);
   try {
      await client.connect();
      const db = client.db(MONGODB_DATABASE);

      console.log(`Seeding MongoDB at ${MONGODB_URI} / ${MONGODB_DATABASE}...`);

      // Drop existing collections
      const existingCollections = await db.listCollections().toArray();
      for (const col of existingCollections) {
         await db.dropCollection(col.name);
         console.log(`  Dropped: ${col.name}`);
      }

      // Create collections with JSON Schema validators
      await db.createCollection("accounts", {
         validator: {
            $jsonSchema: {
               bsonType: "object",
               required: ["_id", "status", "email", "name", "createdAt", "modifiedAt"],
               properties: {
                  _id: { bsonType: "string" },
                  status: { bsonType: "string", enum: ["created", "confirmed", "deleted"] },
                  email: { bsonType: "string" },
                  name: {
                     bsonType: "object",
                     required: ["first", "last"],
                     properties: {
                        first: { bsonType: "string" },
                        last: { bsonType: "string" },
                     },
                  },
                  notes: { bsonType: ["string", "null"] },
                  parent: {
                     bsonType: ["object", "null"],
                     properties: {
                        accountId: { bsonType: "string" },
                        email: { bsonType: "string" },
                     },
                  },
                  createdAt: { bsonType: "date" },
                  modifiedAt: { bsonType: "date" },
               },
            },
         },
      });

      await db.createCollection("products", {
         validator: {
            $jsonSchema: {
               bsonType: "object",
               required: ["_id", "label", "price", "availability", "tags", "createdAt"],
               properties: {
                  _id: { bsonType: "string" },
                  label: { bsonType: "string" },
                  price: { bsonType: "double" },
                  discount: { bsonType: ["double", "null"] },
                  availability: {
                     bsonType: "object",
                     properties: {
                        isAvailable: { bsonType: "bool" },
                        isPublished: { bsonType: "bool" },
                     },
                  },
                  metadata: { bsonType: ["object", "null"] },
                  tags: { bsonType: "array", items: { bsonType: "string" } },
                  createdAt: { bsonType: "date" },
                  modifiedAt: { bsonType: "date" },
               },
            },
         },
      });

      await db.createCollection("orders", {
         validator: {
            $jsonSchema: {
               bsonType: "object",
               required: ["_id", "status", "accountId", "items", "createdAt", "modifiedAt"],
               properties: {
                  _id: { bsonType: "string" },
                  status: { bsonType: "string", enum: ["created", "paid", "delivered", "received"] },
                  accountId: { bsonType: "string" },
                  items: {
                     bsonType: "array",
                     items: {
                        bsonType: "object",
                        required: ["productId", "label", "productPrice", "quantity"],
                        properties: {
                           productId: { bsonType: "string" },
                           label: { bsonType: "string" },
                           productPrice: { bsonType: "double" },
                           discountPrice: { bsonType: ["double", "null"] },
                           quantity: { bsonType: "int" },
                           metadata: { bsonType: ["object", "null"] },
                        },
                     },
                  },
                  createdAt: { bsonType: "date" },
                  modifiedAt: { bsonType: "date" },
               },
            },
         },
      });

      // Insert data
      await db.collection("accounts").insertMany(accounts);
      console.log(`  Inserted ${accounts.length} accounts`);

      await db.collection("products").insertMany(products);
      console.log(`  Inserted ${products.length} products`);

      await db.collection("orders").insertMany(orders);
      console.log(`  Inserted ${orders.length} orders`);

      // Create indexes
      await db.collection("accounts").createIndex({ email: 1 }, { unique: true });
      await db.collection("accounts").createIndex({ status: 1 });
      await db.collection("orders").createIndex({ accountId: 1 });
      await db.collection("orders").createIndex({ status: 1 });
      await db.collection("products").createIndex({ tags: 1 });
      await db.collection("products").createIndex({ "availability.isAvailable": 1 });
      console.log("  Created indexes");

      console.log("\nDone! MongoDB seeded successfully.");
      console.log(`  ${accounts.length} accounts, ${products.length} products, ${orders.length} orders`);
   } finally {
      await client.close();
   }
}

seed().catch((err) => {
   console.error("Seed failed:", err);
   process.exit(1);
});
