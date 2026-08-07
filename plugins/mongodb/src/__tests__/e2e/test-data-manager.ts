/**
 * Test data manager for MongoDB e2e tests.
 * Seeds the test collections (accounts, orders, products) following the
 * document-oriented test schema defined in the issue.
 */
import type { Db } from "mongodb";

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
      metadata: {
         brand: string;
         weight: number;
         dimensions: { width: number; height: number; depth: number };
         colors: string[];
         countryOfOrigin: string;
         releaseDate: string;
         isRecyclable: boolean;
      } | null;
   }[];
   createdAt: Date;
   modifiedAt: Date;
}

const now = new Date("2024-06-15T12:00:00.000Z");
const oneHourAgo = new Date("2024-06-15T11:00:00.000Z");
const twoDaysAgo = new Date("2024-06-13T12:00:00.000Z");

export const testAccounts: TestAccount[] = [
   {
      _id: "acc-1",
      status: "confirmed",
      email: "alice@example.com",
      name: { first: "Alice", last: "Smith" },
      notes: "VIP customer",
      parent: null,
      createdAt: twoDaysAgo,
      modifiedAt: oneHourAgo,
   },
   {
      _id: "acc-2",
      status: "confirmed",
      email: "bob@example.com",
      name: { first: "Bob", last: "Jones" },
      notes: null,
      parent: { accountId: "acc-1", email: "alice@example.com" },
      createdAt: oneHourAgo,
      modifiedAt: now,
   },
   {
      _id: "acc-3",
      status: "created",
      email: "charlie@example.com",
      name: { first: "Charlie", last: "Brown" },
      notes: null,
      parent: null,
      createdAt: now,
      modifiedAt: now,
   },
   {
      _id: "acc-4",
      status: "deleted",
      email: "deleted@example.com",
      name: { first: "Deleted", last: "User" },
      notes: "Removed by admin",
      parent: null,
      createdAt: twoDaysAgo,
      modifiedAt: now,
   },
];

export const testProducts: TestProduct[] = [
   {
      _id: "prod-1",
      label: "Widget Pro",
      price: 29.99,
      discount: 5.0,
      availability: { isAvailable: true, isPublished: true },
      metadata: {
         brand: "WidgetCo",
         weight: 0.5,
         dimensions: { width: 10, height: 5, depth: 3 },
         colors: ["red", "blue", "green"],
         countryOfOrigin: "US",
         releaseDate: "2024-01-15",
         isRecyclable: true,
      },
      tags: ["electronics", "gadgets"],
      createdAt: twoDaysAgo,
      modifiedAt: oneHourAgo,
   },
   {
      _id: "prod-2",
      label: "Basic Widget",
      price: 9.99,
      discount: null,
      availability: { isAvailable: true, isPublished: true },
      metadata: null,
      tags: ["basics"],
      createdAt: oneHourAgo,
      modifiedAt: now,
   },
   {
      _id: "prod-3",
      label: "Premium Widget",
      price: 99.99,
      discount: 15.0,
      availability: { isAvailable: false, isPublished: false },
      metadata: {
         brand: "PremiumCo",
         weight: 1.2,
         dimensions: { width: 20, height: 10, depth: 8 },
         colors: ["gold", "silver"],
         countryOfOrigin: "DE",
         releaseDate: "2024-03-01",
         isRecyclable: false,
      },
      tags: ["premium", "electronics"],
      createdAt: now,
      modifiedAt: now,
   },
];

export const testOrders: TestOrder[] = [
   {
      _id: "ord-1",
      status: "delivered",
      accountId: "acc-1",
      items: [
         {
            productId: "prod-1",
            label: "Widget Pro",
            productPrice: 29.99,
            discountPrice: 24.99,
            quantity: 2,
            metadata: testProducts[0]!.metadata,
         },
         {
            productId: "prod-2",
            label: "Basic Widget",
            productPrice: 9.99,
            discountPrice: null,
            quantity: 1,
            metadata: null,
         },
      ],
      createdAt: twoDaysAgo,
      modifiedAt: oneHourAgo,
   },
   {
      _id: "ord-2",
      status: "paid",
      accountId: "acc-1",
      items: [
         {
            productId: "prod-3",
            label: "Premium Widget",
            productPrice: 99.99,
            discountPrice: 84.99,
            quantity: 1,
            metadata: testProducts[2]!.metadata,
         },
      ],
      createdAt: oneHourAgo,
      modifiedAt: now,
   },
   {
      _id: "ord-3",
      status: "created",
      accountId: "acc-2",
      items: [
         {
            productId: "prod-1",
            label: "Widget Pro",
            productPrice: 29.99,
            discountPrice: 24.99,
            quantity: 5,
            metadata: testProducts[0]!.metadata,
         },
      ],
      createdAt: now,
      modifiedAt: now,
   },
];

/**
 * Seeds all test collections into the provided database.
 * Drops existing collections first for idempotent seeding.
 */
export async function seedTestData(db: Db): Promise<void> {
   // Drop existing collections
   const collections = await db.listCollections().toArray();
   for (const col of collections) {
      await db.dropCollection(col.name);
   }

   // Seed accounts
   await db.collection<TestAccount>("accounts").insertMany(testAccounts);

   // Seed products
   await db.collection<TestProduct>("products").insertMany(testProducts);

   // Seed orders
   await db.collection<TestOrder>("orders").insertMany(testOrders);
}
