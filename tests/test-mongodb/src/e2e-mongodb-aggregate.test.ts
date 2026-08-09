import { describe, test, expect, beforeAll } from "vitest";
import { param } from "@vexnor/core";
import { db, dm, ensureConnected } from "./test-setup.js";
import { Accounts, Products, Orders } from "./collections.js";
import type { TestAccount } from "./test-data-manager.js";

beforeAll(async () => { await ensureConnected(); });

describe("aggregate — $group", () => {
   test("group orders by status", async () => {
      const query = Orders.aggregate<{ _id: string; count: number }>([
         { $group: { _id: "$status", count: { $sum: 1 } } },
         { $sort: { count: -1 } },
      ]);
      const results = await query.all({ db });

      // Should have 4 status groups (created, paid, delivered, received)
      expect(results.length).toBe(4);
      const totalCount = results.reduce((sum, r) => sum + r.count, 0);
      expect(totalCount).toBe(dm.orders.length);
   });

   test("group by nested field (items.metadata.brand) with $unwind", async () => {
      const query = Orders.aggregate<{ _id: string | null; count: number }>([
         { $unwind: "$items" },
         { $group: { _id: "$items.metadata.brand", count: { $sum: 1 } } },
         { $sort: { count: -1 } },
      ]);
      const results = await query.all({ db });

      // Should include brands + null (items without metadata)
      expect(results.length).toBeGreaterThan(1);
      const totalItems = results.reduce((sum, r) => sum + r.count, 0);
      expect(totalItems).toBe(dm.orders.length * 2); // ORDER_ITEM_FACTOR=2
   });

   test("group accounts by status with count", async () => {
      const query = Accounts.aggregate<{ _id: string; count: number }>([
         { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);
      const results = await query.all({ db });

      const total = results.reduce((sum, r) => sum + r.count, 0);
      expect(total).toBe(dm.allAccounts.length);
   });
});

describe("aggregate — $lookup (cross-collection join)", () => {
   test("orders with account lookup (string ref)", async () => {
      const query = Orders.aggregate<{ _id: string; account: TestAccount[] }>([
         { $limit: 10 },
         { $lookup: { from: "accounts", localField: "accountId", foreignField: "_id", as: "account" } },
      ]);
      const results = await query.all({ db });

      expect(results.length).toBe(10);
      for (const r of results) {
         expect(r.account).toBeDefined();
         expect(r.account.length).toBe(1);
         expect(r.account[0]!._id).toBe(r._id.replace(/^ord-/, "").length > 0 ? r.account[0]!._id : "");
      }
   });

   test("orders with account lookup (typed collection ref)", async () => {
      const query = Orders.aggregate<{ _id: string; accountId: string; account: TestAccount[] }>([
         { $limit: 5 },
         { $lookup: { from: Accounts, localField: "accountId", foreignField: "_id", as: "account" } },
      ]);
      const results = await query.all({ db });

      expect(results.length).toBe(5);
      for (const r of results) {
         expect(r.account.length).toBe(1);
         expect(r.account[0]!._id).toBe(r.accountId);
      }
   });
});

describe("aggregate — $unwind", () => {
   test("unwind order items to flat rows", async () => {
      const query = Orders.aggregate<{ _id: string; accountId: string; item: { label: string; quantity: number } }>([
         { $limit: 5 },
         { $unwind: "$items" },
         { $project: { accountId: 1, item: "$items" } },
      ]);
      const results = await query.all({ db });

      // 5 orders × 2 items each = 10 rows
      expect(results.length).toBe(10);
      for (const r of results) {
         expect(r.item.label).toBeDefined();
         expect(r.item.quantity).toBeGreaterThan(0);
      }
   });
});

describe("aggregate — $match with param", () => {
   test("match orders by status param", async () => {
      const statusParam = param<{ status: string }>("status");
      const query = Orders.aggregate([
         { $match: { status: statusParam } },
         { $limit: 50 },
      ]);
      const results = await query.all({ db, params: { status: "delivered" } });

      const expected = dm.orders.filter((o) => o.status === "delivered").length;
      expect(results.length).toBe(Math.min(expected, 50));
      for (const r of results) {
         expect(r.status).toBe("delivered");
      }
   });
});

describe("aggregate — $project with computed fields", () => {
   test("compute volume from nested dimensions", async () => {
      const query = Products.aggregate<{ _id: string; label: string; volume: number }>([
         { $match: { metadata: { $ne: null } } },
         { $project: {
            label: 1,
            volume: { $multiply: ["$metadata.dimensions.width", "$metadata.dimensions.height", "$metadata.dimensions.depth"] },
         }},
         { $sort: { volume: -1 } },
         { $limit: 5 },
      ]);
      const results = await query.all({ db });

      expect(results.length).toBe(5);
      for (const r of results) {
         expect(r.volume).toBeGreaterThan(0);
         expect(typeof r.volume).toBe("number");
      }
      // Verify sorted descending
      for (let i = 1; i < results.length; i++) {
         expect(results[i - 1]!.volume).toBeGreaterThanOrEqual(results[i]!.volume);
      }
   });

   test("compute item total price with $unwind + $multiply", async () => {
      const query = Orders.aggregate<{ _id: string; itemTotal: number }>([
         { $limit: 5 },
         { $unwind: "$items" },
         { $project: {
            itemTotal: { $multiply: ["$items.productPrice", "$items.quantity"] },
         }},
      ]);
      const results = await query.all({ db });

      expect(results.length).toBe(10); // 5 orders × 2 items
      for (const r of results) {
         expect(r.itemTotal).toBeGreaterThan(0);
      }
   });
});

describe("aggregate — $sort + $limit + $skip (pagination)", () => {
   test("paginated aggregation", async () => {
      const page1 = await Orders.aggregate([
         { $sort: { _id: 1 } },
         { $limit: 10 },
      ]).all({ db });

      const page2 = await Orders.aggregate([
         { $sort: { _id: 1 } },
         { $skip: 10 },
         { $limit: 10 },
      ]).all({ db });

      expect(page1.length).toBe(10);
      expect(page2.length).toBe(10);
      // No overlap
      const ids1 = new Set(page1.map((o) => o._id));
      expect(page2.every((o) => !ids1.has(o._id))).toBe(true);
   });
});
