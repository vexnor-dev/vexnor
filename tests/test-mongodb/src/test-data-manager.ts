/**
 * TestDataManager for MongoDB e2e tests.
 *
 * Mirrors the Postgres TestDataManager:
 * - 100 root accounts + 300 children (ACCOUNT_CHILD_FACTOR=3)
 * - 20 products with metadata
 * - 800 orders (ACCOUNT_ORDER_FACTOR=2) with 2 items each
 *
 * Documents use MongoDB-native patterns: nested objects, embedded arrays,
 * denormalized data, nullable nested fields.
 */
import type { Db } from "mongodb";
import { ok } from "node:assert";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TestAccount {
   _id: string;
   status: "created" | "confirmed" | "deleted";
   email: string;
   name: { first: string; last: string };
   notes: string | null;
   parent: { accountId: string; email: string } | null;
   createdAt: Date;
   modifiedAt: Date;
}

export interface TestProduct {
   _id: string;
   label: string;
   price: number;
   discount: number | null;
   availability: { isAvailable: boolean; isPublished: boolean };
   metadata: {
      brand: string;
      weight: number;
      dimensions: { width: number; height: number; depth: number };
      colors: string[];
      countryOfOrigin: string;
      releaseDate: string;
      isRecyclable: boolean;
   } | null;
   tags: string[];
   createdAt: Date;
   modifiedAt: Date;
}

export interface TestOrder {
   _id: string;
   status: "created" | "paid" | "delivered" | "received";
   accountId: string;
   items: {
      productId: string;
      label: string;
      productPrice: number;
      discountPrice: number | null;
      quantity: number;
      metadata: TestProduct["metadata"];
   }[];
   createdAt: Date;
   modifiedAt: Date;
}

// ─── Configuration ───────────────────────────────────────────────────────────

const PRODUCT_COUNT = 20;
const ACCOUNT_ROOT_COUNT = 100;
const ACCOUNT_CHILD_FACTOR = 3;
const ACCOUNT_ORDER_FACTOR = 2;
const ORDER_ITEM_FACTOR = 2;

const STATUSES: TestAccount["status"][] = ["created", "confirmed", "deleted"];
const ORDER_STATUSES: TestOrder["status"][] = ["created", "paid", "delivered", "received"];
const BRANDS = ["WidgetCo", "PremiumCo", "TechCorp", "GadgetInc", "NanoBuild"];
const COUNTRIES = ["US", "DE", "NL", "JP", "CN", "UK", "FR", "CA"];
const COLORS = [["red", "blue"], ["silver", "gold"], ["white", "black"], ["green", "orange"]];
const TAGS = [["electronics", "gadgets"], ["premium", "luxury"], ["basics", "budget"], ["eco", "recycled"]];

function pick<T>(arr: readonly T[], i: number): T {
   return arr[i % arr.length]!;
}

// ─── Manager ─────────────────────────────────────────────────────────────────

export class TestDataManager {
   readonly rootAccounts: TestAccount[] = [];
   readonly childAccounts: TestAccount[] = [];
   readonly products: TestProduct[] = [];
   readonly orders: TestOrder[] = [];
   readonly TAG: string;

   constructor(ctx: { name: string }) {
      this.TAG = ctx.name.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 20);
   }

   get allAccounts(): TestAccount[] {
      return [...this.rootAccounts, ...this.childAccounts];
   }

   get totalAccountCount(): number {
      return ACCOUNT_ROOT_COUNT + ACCOUNT_ROOT_COUNT * ACCOUNT_CHILD_FACTOR;
   }

   get totalOrderCount(): number {
      return this.totalAccountCount * ACCOUNT_ORDER_FACTOR;
   }

   async setup(db: Db): Promise<void> {
      await this.cleanAll(db);
      await this.initProducts(db);
      await this.initRootAccounts(db);
      await this.initChildAccounts(db);
      await this.initOrders(db);
   }

   async cleanAll(db: Db): Promise<void> {
      const collections = await db.listCollections().toArray();
      for (const col of collections) {
         await db.dropCollection(col.name);
      }
   }

   private async initProducts(db: Db): Promise<void> {
      const now = new Date();
      for (let i = 0; i < PRODUCT_COUNT; i++) {
         const hasMetadata = i % 3 !== 0; // ~66% have metadata
         this.products.push({
            _id: `prod-${String(i).padStart(3, "0")}-${this.TAG}`,
            label: `Product-${String(i).padStart(3, "0")}-${this.TAG}`,
            price: Math.round((10 + i * 25.5) * 100) / 100,
            discount: i % 2 === 0 ? Math.round((i * 3.5) * 100) / 100 : null,
            availability: { isAvailable: i < 16, isPublished: i < 14 },
            metadata: hasMetadata ? {
               brand: pick(BRANDS, i),
               weight: Math.round((0.5 + i * 0.3) * 10) / 10,
               dimensions: { width: 5 + i * 2, height: 3 + i, depth: 1 + Math.floor(i / 3) },
               colors: pick(COLORS, i),
               countryOfOrigin: pick(COUNTRIES, i),
               releaseDate: `2024-${String((i % 12) + 1).padStart(2, "0")}-15`,
               isRecyclable: i % 3 === 1,
            } : null,
            tags: pick(TAGS, i),
            createdAt: new Date(now.getTime() - i * 86400000),
            modifiedAt: now,
         });
      }
      await db.collection<TestProduct>("products").insertMany(this.products);
   }

   private async initRootAccounts(db: Db): Promise<void> {
      const now = new Date();
      for (let i = 0; i < ACCOUNT_ROOT_COUNT; i++) {
         const idx = String(i).padStart(3, "0");
         this.rootAccounts.push({
            _id: `acc-root-${idx}-${this.TAG}`,
            status: pick(STATUSES, i),
            email: `root-${idx}-${this.TAG}@example.com`,
            name: { first: `Root-${idx}`, last: `Account-${idx}` },
            notes: i % 4 === 0 ? `Note for root ${idx}` : null,
            parent: null,
            createdAt: new Date(now.getTime() - i * 3600000),
            modifiedAt: now,
         });
      }
      await db.collection<TestAccount>("accounts").insertMany(this.rootAccounts);
   }

   private async initChildAccounts(db: Db): Promise<void> {
      const now = new Date();
      const children: TestAccount[] = [];
      for (let i = 0; i < ACCOUNT_ROOT_COUNT; i++) {
         const parent = this.rootAccounts[i]!;
         for (let k = 0; k < ACCOUNT_CHILD_FACTOR; k++) {
            const idx = `${String(i).padStart(3, "0")}-${k}`;
            const child: TestAccount = {
               _id: `acc-child-${idx}-${this.TAG}`,
               status: pick(STATUSES, i + k),
               email: `child-${idx}-${this.TAG}@example.com`,
               name: { first: `Child-${idx}`, last: `Of-${parent.name.first}` },
               notes: k === 0 ? `Child of ${parent.email}` : null,
               parent: { accountId: parent._id, email: parent.email },
               createdAt: new Date(now.getTime() - (i * ACCOUNT_CHILD_FACTOR + k) * 1800000),
               modifiedAt: now,
            };
            children.push(child);
            this.childAccounts.push(child);
         }
      }
      // Insert in batches
      const BATCH = 500;
      for (let i = 0; i < children.length; i += BATCH) {
         await db.collection<TestAccount>("accounts").insertMany(children.slice(i, i + BATCH));
      }
   }

   private async initOrders(db: Db): Promise<void> {
      const now = new Date();
      const allAccounts = this.allAccounts;
      const orders: TestOrder[] = [];

      for (let a = 0; a < allAccounts.length; a++) {
         const account = allAccounts[a]!;
         for (let o = 0; o < ACCOUNT_ORDER_FACTOR; o++) {
            const orderIdx = a * ACCOUNT_ORDER_FACTOR + o;
            const items: TestOrder["items"] = [];
            for (let it = 0; it < ORDER_ITEM_FACTOR; it++) {
               const product = this.products[(orderIdx * ORDER_ITEM_FACTOR + it) % PRODUCT_COUNT]!;
               items.push({
                  productId: product._id,
                  label: product.label,
                  productPrice: product.price,
                  discountPrice: product.discount ? Math.round((product.price - product.discount) * 100) / 100 : null,
                  quantity: 1 + (orderIdx + it) % 10,
                  metadata: product.metadata,
               });
            }
            const order: TestOrder = {
               _id: `ord-${String(orderIdx).padStart(4, "0")}-${this.TAG}`,
               status: pick(ORDER_STATUSES, orderIdx),
               accountId: account._id,
               items,
               createdAt: new Date(now.getTime() - orderIdx * 60000),
               modifiedAt: now,
            };
            orders.push(order);
            this.orders.push(order);
         }
      }

      // Insert in batches
      const BATCH = 500;
      for (let i = 0; i < orders.length; i += BATCH) {
         await db.collection<TestOrder>("orders").insertMany(orders.slice(i, i + BATCH));
      }
   }
}

// ─── Assertions helper ───────────────────────────────────────────────────────

export function assertTestData(dm: TestDataManager): void {
   ok(dm.rootAccounts.length === ACCOUNT_ROOT_COUNT, `Expected ${ACCOUNT_ROOT_COUNT} root accounts, got ${dm.rootAccounts.length}`);
   ok(dm.childAccounts.length === ACCOUNT_ROOT_COUNT * ACCOUNT_CHILD_FACTOR, `Expected ${ACCOUNT_ROOT_COUNT * ACCOUNT_CHILD_FACTOR} child accounts`);
   ok(dm.products.length === PRODUCT_COUNT, `Expected ${PRODUCT_COUNT} products`);
   ok(dm.orders.length === dm.totalOrderCount, `Expected ${dm.totalOrderCount} orders, got ${dm.orders.length}`);
}
