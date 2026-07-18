/**
 * Tests specifically targeting codecov/patch uncovered lines.
 */
import { describe, it, expect, vi } from "vitest";
import { param, ctx } from "@vexnor/core";
import { collection } from "#src/collection.js";
import { MONGODB_PLUGIN_NAME } from "#src/mongo-query.js";
import { VexnorMongoDB, vexnorMongodb } from "#src/vexnor-mongodb.js";
import { MongoQueryRegistry } from "#src/registry.js";
import { walkValue, walkFilter, walkFindOptions } from "#src/walk-params.js";
import {
   jsonSchemaToDescriptor,
   inferSchemaFromDocuments,
} from "#src/codegen.js";
import { canonicalJson } from "#src/canonical-json.js";
import type { MongoParamInfo } from "#src/mongo-types.js";

// ─── vexnor-mongodb.ts coverage (lines 22-67) ───────────────────────────────

describe("VexnorMongoDB", () => {
   it("has correct plugin metadata", () => {
      const plugin = new VexnorMongoDB();
      expect(plugin.name).toBe(MONGODB_PLUGIN_NAME);
      expect(plugin.driver).toBe("mongodb");
      expect(plugin.dialect).toBe("mongodb");
   });

   it("db returns null when not connected", () => {
      const plugin = new VexnorMongoDB();
      expect(plugin.db).toBeNull();
   });

   it("fromClient sets db from an existing client", () => {
      const plugin = new VexnorMongoDB();
      const mockDb = { databaseName: "test" };
      const mockClient = { db: vi.fn().mockReturnValue(mockDb) };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = plugin.fromClient(mockClient as any, "test");
      expect(result).toBe(mockDb);
      expect(plugin.db).toBe(mockDb);
   });

   it("close does nothing when not connected", async () => {
      const plugin = new VexnorMongoDB();
      await expect(plugin.close()).resolves.toBeUndefined();
   });

   it("close disconnects when connected", async () => {
      const plugin = new VexnorMongoDB();
      const mockClose = vi.fn().mockResolvedValue(undefined);
      const mockClient = {
         db: vi.fn().mockReturnValue({}),
         close: mockClose,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plugin.fromClient(mockClient as any, "test");
      await plugin.close();
      expect(mockClose).toHaveBeenCalled();
      expect(plugin.db).toBeNull();
   });

   it("vexnorMongodb default export is a VexnorMongoDB instance", () => {
      expect(vexnorMongodb).toBeInstanceOf(VexnorMongoDB);
      expect(vexnorMongodb.name).toBe(MONGODB_PLUGIN_NAME);
   });
});

// ─── mongo-query.ts: remote execution (lines 331, 377-392) ──────────────────

describe("MongoQuery remote execution", () => {
   it("dispatches to RemoteClient when db is a remote client", async () => {
      const users = collection("users", {
         source: "test",
         schema: { _id: "string", name: "string" },
      });

      const statusParam = param<{ status: string }>("status");
      const query = users.find({ status: statusParam });

      const mockRemoteClient = {
         remoteExecute: vi.fn().mockResolvedValue([{ _id: "1", name: "Alice" }]),
      };

      const results = await query.all({
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         db: mockRemoteClient as any,
         params: { status: "active" },
      });

      expect(mockRemoteClient.remoteExecute).toHaveBeenCalledWith({
         plugin: MONGODB_PLUGIN_NAME,
         hash: await query.hash,
         params: { status: "active" },
         name: null,
         location: null,
         mode: "read",
      });
      expect(results).toMatchInlineSnapshot(`
        [
          {
            "_id": "1",
            "name": "Alice",
          },
        ]
      `);
   });

   it("strips context params when calling remote", async () => {
      const users = collection("users", {
         source: "test",
         schema: { _id: "string" },
      });

      const userIdCtx = ctx<{ userId: string }>("userId");
      const query = users.find({ _id: userIdCtx });

      const mockRemoteClient = {
         remoteExecute: vi.fn().mockResolvedValue([]),
      };

      await query.all({
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         db: mockRemoteClient as any,
         context: { userId: "user-123" },
      });

      // Context params should be stripped — they're injected server-side
      const callArgs = mockRemoteClient.remoteExecute.mock.calls[0]![0];
      expect(callArgs.params).not.toHaveProperty("userId");
   });
});

// ─── mongo-query.ts: unsupported operation default (line 463) ────────────────

describe("MongoQuery unsupported operation", () => {
   it("throws for unsupported operation type", async () => {
      const users = collection("users", {
         source: "test",
         schema: { _id: "string" },
      });

      // Create a query then forcefully override its operation
      const query = users.find({});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (query as any).operation = "badOp";

      const mockDb = {
         collection: vi.fn().mockReturnValue({}),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(query.all({ db: mockDb as any })).rejects.toThrow("Unsupported MongoDB operation: badOp");
   });
});

// ─── walk-params.ts: array in walkFilter (line 94) ───────────────────────────

describe("walkFilter array branch", () => {
   it("handles array filter (e.g. $or array)", () => {
      const params: Record<string, MongoParamInfo> = {};
      // Pass an array directly to walkFilter (not common in practice but covers the branch)
      const result = walkFilter([{ status: "active" }, { status: "pending" }], params);
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "status": {
              "$literal": "active",
            },
          },
          {
            "status": {
              "$literal": "pending",
            },
          },
        ]
      `);
   });
});

// ─── walk-params.ts: collection ref in walkValue (line 45) ───────────────────

describe("walkValue collection ref", () => {
   it("resolves collection ref to string name in walkValue", () => {
      const orders = collection("orders", { source: "test", schema: { _id: "string" } });
      const params: Record<string, MongoParamInfo> = {};
      const result = walkValue(orders, params, false);
      expect(result).toBe("orders");
   });
});

// ─── walk-params.ts: Date in walkFilter object branch (line 99) ──────────────

describe("walkFilter Date at object level", () => {
   it("handles Date object at filter object level", () => {
      const params: Record<string, MongoParamInfo> = {};
      const date = new Date("2024-01-01T00:00:00.000Z");
      // Pass the Date as the filter itself (object branch, instanceof Date)
      const result = walkFilter(date, params);
      expect(result).toMatchInlineSnapshot(`
        {
          "$literal": "2024-01-01T00:00:00.000Z",
        }
      `);
   });

   it("handles collection ref at filter object level", () => {
      const orders = collection("orders", { source: "test", schema: { _id: "string" } });
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFilter(orders, params);
      expect(result).toBe("orders");
   });
});

// ─── walk-params.ts: walkFilterValue nested doc match (line 162) ─────────────

describe("walkFilterValue nested document match", () => {
   it("recurses into non-operator nested objects", () => {
      const params: Record<string, MongoParamInfo> = {};
      // A nested document match: { address: { city: "NYC", zip: "10001" } }
      // where address value is an object without $ keys → treated as nested doc
      const result = walkFilter({ address: { city: "NYC", zip: "10001" } }, params);
      expect(result).toMatchInlineSnapshot(`
        {
          "address": {
            "city": {
              "$literal": "NYC",
            },
            "zip": {
              "$literal": "10001",
            },
          },
        }
      `);
   });
});

// ─── walk-params.ts: default case in walkFindOptions (lines 200-201) ─────────

describe("walkFindOptions default key", () => {
   it("passes through unknown options via walkValue", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFindOptions({ collation: { locale: "en" } }, params);
      expect(result).toMatchInlineSnapshot(`
        {
          "collation": {
            "locale": "en",
          },
        }
      `);
   });
});

// ─── registry.ts: checkAuthorization body (lines 53-55) ─────────────────────

describe("MongoQueryRegistry checkAuthorization", () => {
   it("iterates over authorized queries without throwing", async () => {
      const registry = new MongoQueryRegistry();
      const users = collection("users", { source: "test", schema: { _id: "string" } });
      const query = users.find({}).authorize("admin");
      await registry.register({ query });
      // Should not throw — just iterates
      expect(() => registry.checkAuthorization()).not.toThrow();
   });
});

// ─── codegen.ts: uncovered branches in jsonSchemaPropertyToFieldDescriptor ───

describe("codegen edge cases", () => {
   it("handles object bsonType without properties (fallback to string)", () => {
      const schema = {
         properties: {
            metadata: { bsonType: "object" as const }, // no nested properties
         },
      };
      const result = jsonSchemaToDescriptor(schema);
      expect(result.metadata).toBe("string");
   });

   it("handles array without items (fallback to ['string'])", () => {
      const schema = {
         properties: {
            tags: { bsonType: "array" as const }, // no items
         },
      };
      const result = jsonSchemaToDescriptor(schema);
      expect(result.tags).toStrictEqual(["string"]);
   });

   it("handles array with scalar items via bsonTypeToScalar", () => {
      const schema = {
         properties: {
            scores: { bsonType: "array" as const, items: { bsonType: "int" as const } },
            flags: { bsonType: "array" as const, items: { bsonType: "bool" as const } },
            dates: { bsonType: "array" as const, items: { bsonType: "date" as const } },
            nums: { bsonType: "array" as const, items: { bsonType: "double" as const } },
            ids: { bsonType: "array" as const, items: { bsonType: "long" as const } },
            unknowns: { bsonType: "array" as const, items: { bsonType: "binary" as const } },
         },
      };
      const result = jsonSchemaToDescriptor(schema);
      expect(result.scores).toStrictEqual(["integer"]);
      expect(result.flags).toStrictEqual(["boolean"]);
      expect(result.dates).toStrictEqual(["date"]);
      expect(result.nums).toStrictEqual(["number"]);
      expect(result.ids).toStrictEqual(["integer"]);
      expect(result.unknowns).toStrictEqual(["string"]); // binary → fallback to string
   });

   it("handles unknown bsonType (fallback to string)", () => {
      const schema = {
         properties: {
            blob: { bsonType: "binData" as const },
         },
      };
      const result = jsonSchemaToDescriptor(schema);
      expect(result.blob).toBe("string");
   });

   it("handles json type instead of bsonType", () => {
      const schema = {
         properties: {
            name: { type: "string" as const },
            count: { type: "number" as const },
         },
      };
      const result = jsonSchemaToDescriptor(schema);
      expect(result.name).toBe("string");
      expect(result.count).toBe("number");
   });

   it("handles array bsonType (first element used)", () => {
      const schema = {
         properties: {
            field: { bsonType: ["string", "null"] as string[] },
         },
      };
      const result = jsonSchemaToDescriptor(schema);
      expect(result.field).toBe("string");
   });

   it("inferSchemaFromDocuments with empty array field", () => {
      const docs = [{ emptyArr: [] }];
      const result = inferSchemaFromDocuments(docs);
      expect(result.emptyArr).toStrictEqual(["string"]);
   });

   it("inferSchemaFromDocuments with number arrays", () => {
      const docs = [{ scores: [85, 90, 95] }];
      const result = inferSchemaFromDocuments(docs);
      expect(result.scores).toStrictEqual(["number"]);
   });

   it("inferSchemaFromDocuments with boolean array", () => {
      const docs = [{ flags: [true, false, true] }];
      const result = inferSchemaFromDocuments(docs);
      expect(result.flags).toStrictEqual(["boolean"]);
   });

   it("inferSchemaFromDocuments with Date array", () => {
      const docs = [{ dates: [new Date("2024-01-01"), new Date("2024-02-01")] }];
      const result = inferSchemaFromDocuments(docs);
      expect(result.dates).toStrictEqual(["date"]);
   });

   it("inferSchemaFromDocuments with unknown scalar type in array", () => {
      // BigInt or Symbol — falls back to "string"
      const docs = [{ weird: [Symbol("x")] }];
      const result = inferSchemaFromDocuments(docs);
      expect(result.weird).toStrictEqual(["string"]);
   });

   it("inferSchemaFromDocuments with integer field", () => {
      const docs = [{ count: 42 }];
      const result = inferSchemaFromDocuments(docs);
      // Can't distinguish int vs float, defaults to number
      expect(result.count).toBe("number");
   });

   it("inferSchemaFromDocuments with float field", () => {
      const docs = [{ price: 19.99 }];
      const result = inferSchemaFromDocuments(docs);
      expect(result.price).toBe("number");
   });
});

// ─── canonical-json.ts: undefined in object (line 20 branch) ─────────────────

describe("canonicalJson edge cases", () => {
   it("handles object with undefined values", () => {
      const result = canonicalJson({ a: 1, b: undefined, c: 3 });
      // undefined values are omitted by JSON.stringify
      expect(result).toMatchInlineSnapshot(`"{"a":1,"c":3}"`);
   });
});
