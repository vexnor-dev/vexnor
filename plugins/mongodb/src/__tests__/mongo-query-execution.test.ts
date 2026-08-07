import { describe, it, expect, vi } from "vitest";
import { param, ctx } from "@vexnor/core";
import { collection } from "#src/collection.js";

interface TestDoc {
   _id: string;
   name: string;
   status: string;
   score: number;
}

const testSchema = {
   _id: "string" as const,
   name: "string" as const,
   status: "string" as const,
   score: "number" as const,
};

const users = collection<TestDoc>("users", {
   source: "@myapp/api:models",
   schema: testSchema,
});

// Mock MongoDB Db object
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
      deleteMany: vi.fn().mockResolvedValue({ deletedCount: 3 }),
      insertOne: vi.fn().mockResolvedValue({ insertedId: "new-id" }),
      insertMany: vi.fn().mockResolvedValue({ insertedIds: ["id1", "id2"] }),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
      updateMany: vi.fn().mockResolvedValue({ matchedCount: 5, modifiedCount: 3 }),
   };

   const mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection),
   };

   return { mockDb, mockCollection, mockCursor };
}

describe("MongoQuery execution", () => {
   describe("find", () => {
      it("executes find with literal filter", async () => {
         const { mockDb, mockCollection, mockCursor } = createMockDb();
         mockCursor.toArray.mockResolvedValue([{ _id: "1", name: "Alice", status: "active", score: 95 }]);

         const query = users.find({ status: "active" });
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const results = await query.all({ db: mockDb as any });

         expect(mockDb.collection).toHaveBeenCalledWith("users");
         expect(mockCollection.find).toHaveBeenCalledWith({ status: "active" });
         expect(results).toHaveLength(1);
         expect(results[0]!.name).toBe("Alice");
      });

      it("executes find with param substitution", async () => {
         const { mockDb, mockCollection, mockCursor } = createMockDb();
         mockCursor.toArray.mockResolvedValue([]);

         const statusParam = param<{ status: string }>("status");
         const query = users.find({ status: statusParam });
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         await query.all({ db: mockDb as any, params: { status: "shipped" } });

         expect(mockCollection.find).toHaveBeenCalledWith({ status: "shipped" });
      });

      it("executes find with ctx substitution", async () => {
         const { mockDb, mockCollection, mockCursor } = createMockDb();
         mockCursor.toArray.mockResolvedValue([]);

         const userIdCtx = ctx<{ userId: string }>("userId");
         const query = users.find({ _id: userIdCtx });
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         await query.all({ db: mockDb as any, context: { userId: "user-123" } });

         expect(mockCollection.find).toHaveBeenCalledWith({ _id: "user-123" });
      });

      it("applies sort, limit, skip options", async () => {
         const { mockDb, mockCursor } = createMockDb();
         mockCursor.toArray.mockResolvedValue([]);

         const limitParam = param<{ limit: number }>("limit");
         const query = users.find(
            { status: "active" },
            { sort: { score: -1 }, limit: limitParam, skip: 10 },
         );
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         await query.all({ db: mockDb as any, params: { limit: 20 } });

         expect(mockCursor.sort).toHaveBeenCalledWith({ score: -1 });
         expect(mockCursor.limit).toHaveBeenCalledWith(20);
         expect(mockCursor.skip).toHaveBeenCalledWith(10);
      });

      it("applies projection option", async () => {
         const { mockDb, mockCursor } = createMockDb();
         mockCursor.toArray.mockResolvedValue([]);

         const query = users.find(
            {},
            { projection: { name: 1, status: 1 } },
         );
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         await query.all({ db: mockDb as any });

         expect(mockCursor.project).toHaveBeenCalledWith({ name: 1, status: 1 });
      });

      it(".one() returns single result", async () => {
         const { mockDb, mockCursor } = createMockDb();
         mockCursor.toArray.mockResolvedValue([{ _id: "1", name: "Alice", status: "active", score: 95 }]);

         const query = users.find({ _id: "1" });
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const result = await query.one({ db: mockDb as any });
         expect(result.name).toBe("Alice");
      });

      it(".one() throws for zero results", async () => {
         const { mockDb, mockCursor } = createMockDb();
         mockCursor.toArray.mockResolvedValue([]);

         const query = users.find({ _id: "nonexistent" });
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         await expect(query.one({ db: mockDb as any })).rejects.toThrow("Expected one result, got 0");
      });

      it(".one() throws for multiple results", async () => {
         const { mockDb, mockCursor } = createMockDb();
         mockCursor.toArray.mockResolvedValue([
            { _id: "1", name: "Alice" },
            { _id: "2", name: "Bob" },
         ]);

         const query = users.find({ status: "active" });
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         await expect(query.one({ db: mockDb as any })).rejects.toThrow("Expected one result, got 2");
      });

      it(".any() returns first result or undefined", async () => {
         const { mockDb, mockCursor } = createMockDb();
         mockCursor.toArray.mockResolvedValue([{ _id: "1", name: "Alice", status: "active", score: 95 }]);

         const query = users.find({ status: "active" });
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const result = await query.any({ db: mockDb as any });
         expect(result!.name).toBe("Alice");
      });

      it(".any() returns undefined for no results", async () => {
         const { mockDb, mockCursor } = createMockDb();
         mockCursor.toArray.mockResolvedValue([]);

         const query = users.find({ status: "nonexistent" });
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const result = await query.any({ db: mockDb as any });
         expect(result).toBeUndefined();
      });
   });

   describe("aggregate", () => {
      it("executes aggregate pipeline", async () => {
         const { mockDb, mockCollection } = createMockDb();
         const mockAggCursor = { toArray: vi.fn().mockResolvedValue([{ _id: "US", count: 42 }]) };
         mockCollection.aggregate.mockReturnValue(mockAggCursor);

         const query = users.aggregate([
            { $match: { status: "active" } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
         ]);
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const results = await query.all({ db: mockDb as any });

         expect(mockCollection.aggregate).toHaveBeenCalledWith([
            { $match: { status: "active" } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
         ]);
         expect(results).toHaveLength(1);
      });

      it("substitutes params in pipeline", async () => {
         const { mockDb, mockCollection } = createMockDb();
         const mockAggCursor = { toArray: vi.fn().mockResolvedValue([]) };
         mockCollection.aggregate.mockReturnValue(mockAggCursor);

         const statusParam = param<{ status: string }>("status");
         const query = users.aggregate([{ $match: { status: statusParam } }]);
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         await query.all({ db: mockDb as any, params: { status: "delivered" } });

         expect(mockCollection.aggregate).toHaveBeenCalledWith([{ $match: { status: "delivered" } }]);
      });
   });

   describe("deleteOne", () => {
      it("executes deleteOne and returns deletedCount", async () => {
         const { mockDb, mockCollection } = createMockDb();
         mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

         const idParam = param<{ id: string }>("id");
         const query = users.deleteOne({ _id: idParam });
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const results = await query.all({ db: mockDb as any, params: { id: "user-1" } });

         expect(mockCollection.deleteOne).toHaveBeenCalledWith({ _id: "user-1" });
         expect(results[0]).toMatchInlineSnapshot(`
           {
             "deletedCount": 1,
           }
         `);
      });
   });

   describe("deleteMany", () => {
      it("executes deleteMany and returns deletedCount", async () => {
         const { mockDb, mockCollection } = createMockDb();
         mockCollection.deleteMany.mockResolvedValue({ deletedCount: 3 });

         const query = users.deleteMany({ status: "deleted" });
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const results = await query.all({ db: mockDb as any });

         expect(mockCollection.deleteMany).toHaveBeenCalledWith({ status: "deleted" });
         expect(results[0]).toMatchInlineSnapshot(`
           {
             "deletedCount": 3,
           }
         `);
      });
   });

   describe("insertOne", () => {
      it("executes insertOne and returns the document", async () => {
         const { mockDb, mockCollection } = createMockDb();

         const docParam = param<{ doc: TestDoc }>("doc");
         const query = users.insertOne(docParam);
         const doc = { _id: "new", name: "Charlie", status: "active", score: 80 };
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const results = await query.all({ db: mockDb as any, params: { doc } });

         expect(mockCollection.insertOne).toHaveBeenCalledWith(doc);
         expect(results[0]).toStrictEqual(doc);
      });
   });

   describe("insertMany", () => {
      it("executes insertMany and returns the documents", async () => {
         const { mockDb, mockCollection } = createMockDb();

         const docsParam = param<{ docs: TestDoc[] }>("docs");
         const query = users.insertMany(docsParam);
         const docs = [
            { _id: "1", name: "A", status: "active", score: 90 },
            { _id: "2", name: "B", status: "active", score: 85 },
         ];
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const results = await query.all({ db: mockDb as any, params: { docs } });

         expect(mockCollection.insertMany).toHaveBeenCalledWith(docs);
         expect(results).toStrictEqual(docs);
      });
   });

   describe("updateOne", () => {
      it("executes updateOne and returns counts", async () => {
         const { mockDb, mockCollection } = createMockDb();
         mockCollection.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

         const idParam = param<{ id: string }>("id");
         const query = users.updateOne({ _id: idParam }, { $set: { status: "inactive" } });
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const results = await query.all({ db: mockDb as any, params: { id: "user-1" } });

         expect(mockCollection.updateOne).toHaveBeenCalledWith(
            { _id: "user-1" },
            { $set: { status: "inactive" } },
         );
         expect(results[0]).toMatchInlineSnapshot(`
           {
             "matchedCount": 1,
             "modifiedCount": 1,
           }
         `);
      });
   });

   describe("updateMany", () => {
      it("executes updateMany and returns counts", async () => {
         const { mockDb, mockCollection } = createMockDb();
         mockCollection.updateMany.mockResolvedValue({ matchedCount: 5, modifiedCount: 3 });

         const query = users.updateMany({ status: "pending" }, { $set: { status: "active" } });
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const results = await query.all({ db: mockDb as any });

         expect(mockCollection.updateMany).toHaveBeenCalledWith(
            { status: "pending" },
            { $set: { status: "active" } },
         );
         expect(results[0]).toMatchInlineSnapshot(`
           {
             "matchedCount": 5,
             "modifiedCount": 3,
           }
         `);
      });
   });

   describe("async db resolution", () => {
      it("awaits a Promise<Db>", async () => {
         const { mockDb, mockCursor } = createMockDb();
         mockCursor.toArray.mockResolvedValue([{ _id: "1", name: "Alice", status: "active", score: 95 }]);

         const query = users.find({ status: "active" });
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const results = await query.all({ db: Promise.resolve(mockDb) as any });

         expect(results).toHaveLength(1);
      });
   });
});
