import { describe, it, expect, vi } from "vitest";
import { param, ctx } from "@vexnor/core";
import { collection } from "#src/collection.js";
import { MongoQueryRegistry } from "#src/registry.js";

const users = collection("users", {
   source: "@test:models",
   schema: { _id: "string", name: "string", status: "string" },
});

function createMockDb() {
   const mockCursor = {
      project: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
   };

   const mockCollection = {
      find: vi.fn().mockReturnValue(mockCursor),
      aggregate: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
      deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
      insertOne: vi.fn().mockResolvedValue({ insertedId: "id" }),
      insertMany: vi.fn().mockResolvedValue({ insertedIds: [] }),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 0, modifiedCount: 0 }),
      updateMany: vi.fn().mockResolvedValue({ matchedCount: 0, modifiedCount: 0 }),
   };

   return {
      collection: vi.fn().mockReturnValue(mockCollection),
      mockCollection,
      mockCursor,
   };
}

describe("MongoQueryRegistry.execute", () => {
   it("executes a registered query by hash", async () => {
      const registry = new MongoQueryRegistry();
      const findActive = users.find({ status: "active" });
      await registry.register({ findActive });

      const hash = await findActive.hash;
      const mockDb = createMockDb();
      mockDb.mockCursor.toArray.mockResolvedValue([{ _id: "1", name: "Alice", status: "active" }]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = await registry.execute({ hash, params: {}, mode: "read" }, mockDb as any);

      expect(results).toMatchInlineSnapshot(`
        [
          {
            "_id": "1",
            "name": "Alice",
            "status": "active",
          },
        ]
      `);
   });

   it("throws for unknown hash", async () => {
      const registry = new MongoQueryRegistry();

      const mockDb = createMockDb();
      await expect(
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         registry.execute({ hash: "nonexistent", params: {}, mode: "read" }, mockDb as any),
      ).rejects.toThrow("Unknown MongoDB query hash: nonexistent");
   });

   it("merges context params during execution", async () => {
      const registry = new MongoQueryRegistry<{ userId: string }>();
      const userIdCtx = ctx<{ userId: string }>("userId");
      const findMyDocs = users.find({ _id: userIdCtx });
      await registry.register({ findMyDocs });

      const hash = await findMyDocs.hash;
      const mockDb = createMockDb();
      mockDb.mockCursor.toArray.mockResolvedValue([]);

      await registry.execute(
         { hash, params: {}, mode: "read" },
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         mockDb as any,
         { userId: "user-42" },
      );

      expect(mockDb.mockCollection.find).toHaveBeenCalledWith({ _id: "user-42" });
   });

   it("passes user params through to execution", async () => {
      const registry = new MongoQueryRegistry();
      const statusParam = param<{ status: string }>("status");
      const findByStatus = users.find({ status: statusParam });
      await registry.register({ findByStatus });

      const hash = await findByStatus.hash;
      const mockDb = createMockDb();
      mockDb.mockCursor.toArray.mockResolvedValue([]);

      await registry.execute(
         { hash, params: { status: "shipped" }, mode: "read" },
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         mockDb as any,
      );

      expect(mockDb.mockCollection.find).toHaveBeenCalledWith({ status: "shipped" });
   });
});
