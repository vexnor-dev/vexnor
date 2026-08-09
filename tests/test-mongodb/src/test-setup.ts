/**
 * Shared test setup — provides db and data manager.
 * Uses lazy initialization to ensure global-setup has completed before reading.
 */
import { MongoClient } from "mongodb";
import { MONGODB_URI, MONGODB_DATABASE } from "./config.js";
import { TestDataManager } from "./test-data-manager.js";

const client = new MongoClient(MONGODB_URI);

export const db = client.db(MONGODB_DATABASE);
export const dm = new TestDataManager({ name: "vitest" });

let initialized = false;

export async function ensureConnected(): Promise<void> {
   if (initialized) return;
   await client.connect();

   // Read the seeded data into the data manager
   const accounts = await db.collection("accounts").find({}).toArray();
   for (const a of accounts) {
      if ((a as unknown as { parent: unknown }).parent === null) {
         dm.rootAccounts.push(a as unknown as (typeof dm.rootAccounts)[number]);
      } else {
         dm.childAccounts.push(a as unknown as (typeof dm.childAccounts)[number]);
      }
   }
   dm.products.push(
      ...(await db.collection("products").find({}).toArray()) as unknown as (typeof dm.products),
   );
   dm.orders.push(
      ...(await db.collection("orders").find({}).toArray()) as unknown as (typeof dm.orders),
   );

   initialized = true;
}
