import { describe, test, expect, beforeAll } from "vitest";
import { param, ctx } from "@vexnor/core";
import { MongoQueryRegistry, serializeMongoManifest } from "@vexnor/mongodb";
import { db, dm, ensureConnected } from "./test-setup.js";
import { Accounts, Products, Orders } from "./collections.js";

beforeAll(async () => { await ensureConnected(); });

describe("MongoQueryRegistry — e2e", () => {
   test("register and execute by hash", async () => {
      const registry = new MongoQueryRegistry();
      const statusParam = param<{ status: string }>("status");
      const findByStatus = Accounts.find({ status: statusParam }, { limit: 10 });

      await registry.register({ findByStatus });

      const hash = await findByStatus.hash;
      const results = await registry.execute(
         { hash, params: { status: "confirmed" }, mode: "read" },
         db,
      );

      expect(Array.isArray(results)).toBe(true);
      const rows = results as { status: string }[];
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThanOrEqual(10);
      for (const r of rows) {
         expect(r.status).toBe("confirmed");
      }
   });

   test("execute with context params", async () => {
      const registry = new MongoQueryRegistry<{ userId: string }>();
      const userIdCtx = ctx<{ userId: string }>("userId");
      const findById = Accounts.find({ _id: userIdCtx });

      await registry.register({ findById });

      const target = dm.rootAccounts[3]!;
      const hash = await findById.hash;
      const results = await registry.execute(
         { hash, params: {}, mode: "read" },
         db,
         { userId: target._id },
      );

      const rows = results as { _id: string; email: string }[];
      expect(rows.length).toBe(1);
      expect(rows[0]!._id).toBe(target._id);
   });

   test("execute aggregate via registry", async () => {
      const registry = new MongoQueryRegistry();
      const ordersByStatus = Orders.aggregate<{ _id: string; count: number }>([
         { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);

      await registry.register({ ordersByStatus });

      const hash = await ordersByStatus.hash;
      const results = await registry.execute(
         { hash, params: {}, mode: "read" },
         db,
      );

      const rows = results as { _id: string; count: number }[];
      expect(rows.length).toBe(4);
      const total = rows.reduce((s, r) => s + r.count, 0);
      expect(total).toBe(dm.totalOrderCount);
   });

   test("rejects unknown hash", async () => {
      const registry = new MongoQueryRegistry();
      await expect(
         registry.execute({ hash: "bad-hash", params: {}, mode: "read" }, db),
      ).rejects.toThrow("Unknown MongoDB query hash");
   });

   test("multiple queries registered correctly", async () => {
      const registry = new MongoQueryRegistry();
      const q1 = Accounts.find({ status: "confirmed" });
      const q2 = Products.find({ "availability.isAvailable": true });
      const q3 = Orders.find({ status: "delivered" });

      await registry.register({ q1, q2, q3 });

      const registered = registry.getRegisteredQueries();
      expect(registered.length).toBe(3);
   });
});

describe("serializeMongoManifest — e2e", () => {
   test("produces valid manifest from real queries", async () => {
      const statusParam = param<{ status: string }>("status");
      const limitParam = param<{ limit: number }>("limit");

      const queries = {
         findByStatus: Accounts.find({ status: statusParam }, { limit: limitParam }),
         findProducts: Products.find({ "availability.isAvailable": true }),
         ordersByStatus: Orders.aggregate<{ _id: string; count: number }>([
            { $group: { _id: "$status", count: { $sum: 1 } } },
         ]),
      };

      const manifest = await serializeMongoManifest(queries);

      expect(manifest.version).toBe(1);
      expect(manifest.dialect).toBe("mongodb");
      expect(Object.keys(manifest.queries).length).toBe(3);

      // Verify each entry has required fields
      for (const entry of Object.values(manifest.queries)) {
         expect(entry.name).toBeDefined();
         expect(entry.hash).toMatch(/^[a-f0-9]{64}$/);
         expect(entry.descriptor).toBeDefined();
         expect(entry.schema).toBeDefined();
      }

      // Verify params are captured
      const findByStatusHash = await queries.findByStatus.hash;
      const findByStatusEntry = manifest.queries[findByStatusHash]!;
      expect(findByStatusEntry.params.status).toMatchObject({ name: "status", isContext: false });
      expect(findByStatusEntry.params.limit).toMatchObject({ name: "limit", isContext: false });
   });
});
