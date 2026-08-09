import { describe, test, expect, beforeAll } from "vitest";
import { param, ctx } from "@vexnor/core";
import { db, dm, ensureConnected } from "./test-setup.js";
import { Accounts, Products, Orders } from "./collections.js";

beforeAll(async () => { await ensureConnected(); });

describe("find — basic queries", () => {
   test("find all accounts", async () => {
      const results = await Accounts.find({}).all({ db });
      expect(results.length).toBe(dm.allAccounts.length);
   });

   test("find with literal filter", async () => {
      const expected = dm.allAccounts.filter((a) => a.status === "confirmed");
      const results = await Accounts.find({ status: "confirmed" }).all({ db });
      expect(results.length).toBe(expected.length);
   });

   test("find with param filter", async () => {
      const statusParam = param<{ status: string }>("status");
      const query = Accounts.find({ status: statusParam });
      const results = await query.all({ db, params: { status: "created" } });
      const expected = dm.allAccounts.filter((a) => a.status === "created");
      expect(results.length).toBe(expected.length);
   });

   test("find with ctx filter", async () => {
      const userIdCtx = ctx<{ userId: string }>("userId");
      const query = Accounts.find({ _id: userIdCtx });
      const target = dm.rootAccounts[0]!;
      const result = await query.one({ db, context: { userId: target._id } });
      expect(result._id).toBe(target._id);
      expect(result.email).toBe(target.email);
   });

   test("find with sort + limit", async () => {
      const limitParam = param<{ limit: number }>("limit");
      const query = Accounts.find({}, { sort: { createdAt: -1 }, limit: limitParam });
      const results = await query.all({ db, params: { limit: 5 } });
      expect(results.length).toBe(5);
      for (let i = 1; i < results.length; i++) {
         expect(new Date(results[i - 1]!.createdAt).getTime()).toBeGreaterThanOrEqual(
            new Date(results[i]!.createdAt).getTime(),
         );
      }
   });

   test("find with skip (pagination)", async () => {
      const q1 = Accounts.find({}, { sort: { _id: 1 }, limit: 5 });
      const q2 = Accounts.find({}, { sort: { _id: 1 }, limit: 5, skip: 5 });
      const page1 = await q1.all({ db });
      const page2 = await q2.all({ db });
      expect(page1.length).toBe(5);
      expect(page2.length).toBe(5);
      const ids1 = new Set(page1.map((a) => a._id));
      expect(page2.every((a) => !ids1.has(a._id))).toBe(true);
   });

   test("find with projection", async () => {
      const query = Accounts.find({}, { projection: { email: 1, status: 1, _id: 0 }, limit: 3 });
      const results = await query.all({ db });
      expect(results.length).toBe(3);
      for (const r of results) {
         expect(r).toHaveProperty("email");
         expect(r).toHaveProperty("status");
         expect(r).not.toHaveProperty("name");
      }
   });

   test(".one() throws for zero results", async () => {
      const query = Accounts.find({ _id: "nonexistent-xxxxx" });
      await expect(query.one({ db })).rejects.toThrow("Expected one result, got 0");
   });

   test(".any() returns undefined for zero results", async () => {
      const result = await Accounts.find({ _id: "nonexistent-xxxxx" }).any({ db });
      expect(result).toBeUndefined();
   });
});

describe("find — dot-path queries on nested fields", () => {
   test("query availability.isAvailable", async () => {
      const results = await Products.find({ "availability.isAvailable": true }).all({ db });
      const expected = dm.products.filter((p) => p.availability.isAvailable);
      expect(results.length).toBe(expected.length);
   });

   test("query metadata.brand", async () => {
      const brand = "WidgetCo";
      const results = await Products.find({ "metadata.brand": brand }).all({ db });
      const expected = dm.products.filter((p) => p.metadata?.brand === brand);
      expect(results.length).toBe(expected.length);
   });

   test("query items.productId (array element field)", async () => {
      const productId = dm.products[0]!._id;
      const results = await Orders.find({ "items.productId": productId }).all({ db });
      const expected = dm.orders.filter((o) => o.items.some((it) => it.productId === productId));
      expect(results.length).toBe(expected.length);
   });

   test("query metadata.dimensions.width with $gt", async () => {
      const results = await Products.find({ "metadata.dimensions.width": { $gt: 30 } }).all({ db });
      const expected = dm.products.filter((p) => p.metadata && p.metadata.dimensions.width > 30);
      expect(results.length).toBe(expected.length);
   });

   test("query metadata.colors (scalar array containment)", async () => {
      const results = await Products.find({ "metadata.colors": "red" }).all({ db });
      const expected = dm.products.filter((p) => p.metadata?.colors.includes("red"));
      expect(results.length).toBe(expected.length);
   });
});

describe("find — MongoDB operators", () => {
   test("$in", async () => {
      const results = await Accounts.find({ status: { $in: ["confirmed", "created"] } }).all({ db });
      const expected = dm.allAccounts.filter((a) => a.status === "confirmed" || a.status === "created");
      expect(results.length).toBe(expected.length);
   });

   test("$ne", async () => {
      const results = await Accounts.find({ status: { $ne: "deleted" } }).all({ db });
      const expected = dm.allAccounts.filter((a) => a.status !== "deleted");
      expect(results.length).toBe(expected.length);
   });

   test("$gte/$lte range on price", async () => {
      const results = await Products.find({ price: { $gte: 50, $lte: 200 } }).all({ db });
      const expected = dm.products.filter((p) => p.price >= 50 && p.price <= 200);
      expect(results.length).toBe(expected.length);
   });

   test("$regex", async () => {
      const results = await Accounts.find({ email: { $regex: "root-00[0-5]" } }).all({ db });
      expect(results.length).toBe(6);
   });
});

describe("find — parent/child relationships", () => {
   test("find children by parent.accountId", async () => {
      const parent = dm.rootAccounts[0]!;
      const results = await Accounts.find({ "parent.accountId": parent._id }).all({ db });
      expect(results.length).toBe(3);
   });

   test("find root accounts (parent is null)", async () => {
      const results = await Accounts.find({ parent: null }).all({ db });
      expect(results.length).toBe(dm.rootAccounts.length);
   });
});
