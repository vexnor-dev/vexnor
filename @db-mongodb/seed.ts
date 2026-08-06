/**
 * MongoDB seed script — populates the local MongoDB with realistic demo data
 * at the same scale as the Postgres/MSSQL/SQLite e2e test fixtures.
 *
 * Run: pnpm db-seed:mongodb
 *
 * Generates:
 * - 100 root accounts + 300 child accounts (3 per root) = 400 accounts
 * - 20 products with metadata, dimensions, colors, tags
 * - 800 orders (2 per account) with 2 embedded items each = 1600 order items
 */
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017";
const MONGODB_DATABASE = process.env.MONGODB_DATABASE ?? "vexnor";

// ─── Configuration (matches Postgres TestDataManager) ────────────────────────

const PRODUCT_COUNT = 20;
const ACCOUNT_ROOT_COUNT = 100;
const ACCOUNT_CHILD_FACTOR = 3;
const ACCOUNT_ORDER_FACTOR = 2;
const ORDER_ITEM_FACTOR = 2;

// ─── Generators ──────────────────────────────────────────────────────────────

const STATUSES = ["created", "confirmed", "deleted"] as const;
const ORDER_STATUSES = ["created", "paid", "delivered", "received"] as const;
const BRANDS = ["WidgetCo", "PremiumCo", "TechCorp", "GadgetInc", "NanoBuild"];
const COUNTRIES = ["US", "DE", "NL", "JP", "CN", "UK", "FR", "CA"];
const COLOR_PALETTES = [
   ["red", "blue", "green"],
   ["midnight-blue", "silver", "rose-gold"],
   ["gold", "platinum"],
   ["white", "black", "grey"],
   ["matte-black"],
   ["forest-green", "ocean-blue", "sunset-orange"],
];
const TAG_POOLS = [
   ["electronics", "gadgets"],
   ["basics", "starter"],
   ["premium", "luxury"],
   ["mini", "budget"],
   ["enterprise", "coming-soon"],
   ["wireless", "portable"],
   ["eco-friendly", "recycled"],
   ["best-seller", "trending"],
];
const FIRST_NAMES = [
   "Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry",
   "Ivy", "Jack", "Karen", "Liam", "Mia", "Noah", "Olivia", "Peter",
   "Quinn", "Rachel", "Sam", "Tina", "Uma", "Victor", "Wendy", "Xavier",
   "Yara", "Zack",
];
const LAST_NAMES = [
   "Smith", "Jones", "Brown", "Wilson", "Taylor", "Anderson", "Thomas",
   "Jackson", "White", "Harris", "Martin", "Garcia", "Clark", "Lewis",
   "Lee", "Walker", "Hall", "Allen", "Young", "King",
];

function randomFrom<T>(arr: readonly T[]): T {
   return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomDate(daysBack: number): Date {
   const now = Date.now();
   const offset = Math.floor(Math.random() * daysBack * 24 * 60 * 60 * 1000);
   return new Date(now - offset);
}

function randomPrice(min: number, max: number): number {
   return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

// ─── Generate Products ───────────────────────────────────────────────────────

function generateProducts(): Array<Record<string, unknown>> {
   const products: Array<Record<string, unknown>> = [];
   for (let i = 0; i < PRODUCT_COUNT; i++) {
      const idx = String(i).padStart(3, "0");
      const hasMetadata = Math.random() > 0.3;
      const createdAt = randomDate(60);
      products.push({
         _id: `prod-${idx}`,
         label: `Product-${idx}`,
         price: randomPrice(4.99, 499.99),
         discount: Math.random() > 0.5 ? randomPrice(1, 50) : null,
         availability: {
            isAvailable: Math.random() > 0.2,
            isPublished: Math.random() > 0.3,
         },
         metadata: hasMetadata
            ? {
                 brand: randomFrom(BRANDS),
                 weight: Math.round(Math.random() * 50 * 10) / 10,
                 dimensions: {
                    width: Math.floor(Math.random() * 40) + 2,
                    height: Math.floor(Math.random() * 30) + 2,
                    depth: Math.floor(Math.random() * 20) + 1,
                 },
                 colors: randomFrom(COLOR_PALETTES),
                 countryOfOrigin: randomFrom(COUNTRIES),
                 releaseDate: `2024-${String(Math.floor(Math.random() * 12) + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, "0")}`,
                 isRecyclable: Math.random() > 0.4,
              }
            : null,
         tags: randomFrom(TAG_POOLS),
         createdAt,
         modifiedAt: new Date(createdAt.getTime() + Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
      });
   }
   return products;
}

// ─── Generate Accounts ───────────────────────────────────────────────────────

interface AccountDoc {
   _id: string;
   status: string;
   email: string;
   name: { first: string; last: string };
   notes: string | null;
   parent: { accountId: string; email: string } | null;
   createdAt: Date;
   modifiedAt: Date;
}

function generateAccounts(): AccountDoc[] {
   const accounts: AccountDoc[] = [];

   // Root accounts
   for (let i = 0; i < ACCOUNT_ROOT_COUNT; i++) {
      const idx = String(i).padStart(3, "0");
      const id = crypto.randomUUID().slice(0, 8);
      const first = randomFrom(FIRST_NAMES);
      const last = randomFrom(LAST_NAMES);
      const createdAt = randomDate(90);
      accounts.push({
         _id: `acc-root-${idx}-${id}`,
         status: randomFrom(STATUSES),
         email: `${first.toLowerCase()}.${last.toLowerCase()}.${idx}@example.com`,
         name: { first: `${first}-${idx}`, last: `${last}-${idx}` },
         notes: Math.random() > 0.7 ? `Note for account ${idx}` : null,
         parent: null,
         createdAt,
         modifiedAt: new Date(createdAt.getTime() + Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000)),
      });
   }

   // Child accounts (ACCOUNT_CHILD_FACTOR per root)
   for (let i = 0; i < ACCOUNT_ROOT_COUNT; i++) {
      const parent = accounts[i]!;
      for (let k = 0; k < ACCOUNT_CHILD_FACTOR; k++) {
         const idx = String(i).padStart(3, "0");
         const childIdx = String(k).padStart(2, "0");
         const id = crypto.randomUUID().slice(0, 8);
         const first = randomFrom(FIRST_NAMES);
         const last = randomFrom(LAST_NAMES);
         const createdAt = randomDate(60);
         accounts.push({
            _id: `acc-child-${idx}-${childIdx}-${id}`,
            status: randomFrom(STATUSES),
            email: `${first.toLowerCase()}.${last.toLowerCase()}.child-${idx}-${childIdx}@example.com`,
            name: { first: `${first}-${idx}-${childIdx}`, last: `${last}-${idx}-${childIdx}` },
            notes: Math.random() > 0.8 ? `Child of ${parent.email}` : null,
            parent: { accountId: parent._id, email: parent.email },
            createdAt,
            modifiedAt: new Date(createdAt.getTime() + Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
         });
      }
   }

   return accounts;
}

// ─── Generate Orders ─────────────────────────────────────────────────────────

function generateOrders(accounts: AccountDoc[], products: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
   const orders: Array<Record<string, unknown>> = [];

   for (const account of accounts) {
      for (let o = 0; o < ACCOUNT_ORDER_FACTOR; o++) {
         const orderIdx = String(orders.length).padStart(4, "0");
         const createdAt = randomDate(30);

         // Embedded items (ORDER_ITEM_FACTOR items per order)
         const items = [];
         for (let itemIdx = 0; itemIdx < ORDER_ITEM_FACTOR; itemIdx++) {
            const product = products[(orders.length * ORDER_ITEM_FACTOR + itemIdx) % products.length]!;
            const productPrice = product.price as number;
            const discount = product.discount as number | null;
            items.push({
               productId: product._id as string,
               label: product.label as string,
               productPrice,
               discountPrice: discount ? Math.round((productPrice - discount) * 100) / 100 : null,
               quantity: Math.floor(Math.random() * 10) + 1,
               metadata: product.metadata ?? null,
            });
         }

         orders.push({
            _id: `ord-${orderIdx}`,
            status: randomFrom(ORDER_STATUSES),
            accountId: account._id,
            items,
            createdAt,
            modifiedAt: new Date(createdAt.getTime() + Math.floor(Math.random() * 3 * 24 * 60 * 60 * 1000)),
         });
      }
   }

   return orders;
}

// ─── Seed ────────────────────────────────────────────────────────────────────

async function seed() {
   const client = new MongoClient(MONGODB_URI);
   try {
      await client.connect();
      const db = client.db(MONGODB_DATABASE);

      console.log(`Seeding MongoDB at ${MONGODB_URI} / ${MONGODB_DATABASE}...`);
      console.log(`  Config: ${ACCOUNT_ROOT_COUNT} root + ${ACCOUNT_ROOT_COUNT * ACCOUNT_CHILD_FACTOR} child accounts, ${PRODUCT_COUNT} products, ${(ACCOUNT_ROOT_COUNT + ACCOUNT_ROOT_COUNT * ACCOUNT_CHILD_FACTOR) * ACCOUNT_ORDER_FACTOR} orders`);

      // Drop existing collections
      const existingCollections = await db.listCollections().toArray();
      for (const col of existingCollections) {
         await db.dropCollection(col.name);
      }

      // Generate data
      const products = generateProducts();
      const accounts = generateAccounts();
      const orders = generateOrders(accounts, products);

      console.log(`  Generated: ${accounts.length} accounts, ${products.length} products, ${orders.length} orders (${orders.length * ORDER_ITEM_FACTOR} items)`);

      // Create collections with validators
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
                  parent: { bsonType: ["object", "null"] },
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
                  price: { bsonType: ["double", "int"] },
                  discount: { bsonType: ["double", "int", "null"] },
                  availability: { bsonType: "object" },
                  metadata: { bsonType: ["object", "null"] },
                  tags: { bsonType: "array" },
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
                  items: { bsonType: "array" },
                  createdAt: { bsonType: "date" },
                  modifiedAt: { bsonType: "date" },
               },
            },
         },
      });

      // Insert in batches
      const BATCH_SIZE = 500;

      for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
         await db.collection("accounts").insertMany(accounts.slice(i, i + BATCH_SIZE));
      }
      console.log(`  Inserted ${accounts.length} accounts`);

      await db.collection("products").insertMany(products);
      console.log(`  Inserted ${products.length} products`);

      for (let i = 0; i < orders.length; i += BATCH_SIZE) {
         await db.collection("orders").insertMany(orders.slice(i, i + BATCH_SIZE));
      }
      console.log(`  Inserted ${orders.length} orders`);

      // Create indexes
      await db.collection("accounts").createIndex({ email: 1 }, { unique: true });
      await db.collection("accounts").createIndex({ status: 1 });
      await db.collection("accounts").createIndex({ "parent.accountId": 1 });
      await db.collection("accounts").createIndex({ createdAt: -1 });
      await db.collection("orders").createIndex({ accountId: 1 });
      await db.collection("orders").createIndex({ status: 1 });
      await db.collection("orders").createIndex({ createdAt: -1 });
      await db.collection("orders").createIndex({ "items.productId": 1 });
      await db.collection("products").createIndex({ tags: 1 });
      await db.collection("products").createIndex({ "availability.isAvailable": 1, "availability.isPublished": 1 });
      await db.collection("products").createIndex({ price: 1 });
      console.log("  Created indexes");

      console.log(`\nDone! MongoDB seeded successfully.`);
      console.log(`  ${accounts.length} accounts (${ACCOUNT_ROOT_COUNT} root + ${accounts.length - ACCOUNT_ROOT_COUNT} children)`);
      console.log(`  ${products.length} products`);
      console.log(`  ${orders.length} orders (${orders.length * ORDER_ITEM_FACTOR} embedded items)`);
   } finally {
      await client.close();
   }
}

seed().catch((err) => {
   console.error("Seed failed:", err);
   process.exit(1);
});
