import { describe, test, expect, beforeAll } from "vitest";
import { param } from "@vexnor/core";
import { db, dm, ensureConnected } from "./test-setup.js";
import { Accounts } from "./collections.js";
import type { TestAccount } from "./test-data-manager.js";

const TAG = "mutation-e2e";

beforeAll(async () => { await ensureConnected(); });

describe("insertOne", () => {
   test("insert a new account", async () => {
      const docParam = param<{ doc: TestAccount }>("doc");
      const insertAccount = Accounts.insertOne(docParam);

      const newAccount: TestAccount = {
         _id: `acc-insert-test-${TAG}`,
         status: "created",
         email: `insert-test-${TAG}@example.com`,
         name: { first: "Insert", last: "Test" },
         notes: "Inserted by e2e test",
         parent: null,
         createdAt: new Date(),
         modifiedAt: new Date(),
      };

      await insertAccount.all({ db, params: { doc: newAccount } });

      // Verify
      const found = await Accounts.find({ _id: newAccount._id }).one({ db });
      expect(found.email).toBe(newAccount.email);
      expect(found.notes).toBe("Inserted by e2e test");
   });
});

describe("insertMany", () => {
   test("insert multiple accounts", async () => {
      const docsParam = param<{ docs: TestAccount[] }>("docs");
      const insertMany = Accounts.insertMany(docsParam);

      const docs: TestAccount[] = Array.from({ length: 5 }, (_, i) => ({
         _id: `acc-bulk-${i}-${TAG}`,
         status: "created" as const,
         email: `bulk-${i}-${TAG}@example.com`,
         name: { first: `Bulk-${i}`, last: "Test" },
         notes: null,
         parent: null,
         createdAt: new Date(),
         modifiedAt: new Date(),
      }));

      await insertMany.all({ db, params: { docs } });

      // Verify all exist
      const found = await Accounts.find({ email: { $regex: `bulk-.*-${TAG}@` } }).all({ db });
      expect(found.length).toBe(5);
   });
});

describe("deleteOne", () => {
   test("delete a single account", async () => {
      // Insert one to delete
      const target: TestAccount = {
         _id: `acc-delete-one-${TAG}`,
         status: "created",
         email: `delete-one-${TAG}@example.com`,
         name: { first: "Delete", last: "One" },
         notes: null,
         parent: null,
         createdAt: new Date(),
         modifiedAt: new Date(),
      };
      const docParam = param<{ doc: TestAccount }>("doc");
      await Accounts.insertOne(docParam).all({ db, params: { doc: target } });

      // Delete
      const idParam = param<{ id: string }>("id");
      const result = await Accounts.deleteOne({ _id: idParam }).all({ db, params: { id: target._id } });
      expect(result[0]!.deletedCount).toBe(1);

      // Verify gone
      const found = await Accounts.find({ _id: target._id }).any({ db });
      expect(found).toBeUndefined();
   });
});

describe("deleteMany", () => {
   test("delete multiple accounts", async () => {
      // Insert some to delete
      const docsParam = param<{ docs: TestAccount[] }>("docs");
      const docs: TestAccount[] = Array.from({ length: 3 }, (_, i) => ({
         _id: `acc-delete-many-${i}-${TAG}`,
         status: "deleted" as const,
         email: `delete-many-${i}-${TAG}@example.com`,
         name: { first: `DeleteMany-${i}`, last: "Test" },
         notes: null,
         parent: null,
         createdAt: new Date(),
         modifiedAt: new Date(),
      }));
      await Accounts.insertMany(docsParam).all({ db, params: { docs } });

      // Delete all with matching pattern
      const result = await Accounts.deleteMany({ email: { $regex: `delete-many-.*-${TAG}@` } }).all({ db });
      expect(result[0]!.deletedCount).toBe(3);
   });
});

describe("updateOne", () => {
   test("update a single account", async () => {
      const target = dm.rootAccounts[5]!;
      const idParam = param<{ id: string }>("id");

      const result = await Accounts.updateOne(
         { _id: idParam },
         { $set: { notes: "updated-by-e2e" } },
      ).all({ db, params: { id: target._id } });

      expect(result[0]!.matchedCount).toBe(1);
      expect(result[0]!.modifiedCount).toBe(1);

      // Verify
      const updated = await Accounts.find({ _id: target._id }).one({ db });
      expect(updated.notes).toBe("updated-by-e2e");
   });
});

describe("updateMany", () => {
   test("update multiple accounts", async () => {
      // Count how many have this status
      const targetStatus = "confirmed";
      const confirmedCount = dm.allAccounts.filter((a) => a.status === targetStatus).length;

      const result = await Accounts.updateMany(
         { status: targetStatus },
         { $set: { notes: "batch-updated-e2e" } },
      ).all({ db });

      expect(result[0]!.matchedCount).toBe(confirmedCount);
      expect(result[0]!.modifiedCount).toBeGreaterThanOrEqual(1);

      // Verify at least some were updated
      const updated = await Accounts.find({ notes: "batch-updated-e2e" }).all({ db });
      expect(updated.length).toBe(confirmedCount);
   });
});
