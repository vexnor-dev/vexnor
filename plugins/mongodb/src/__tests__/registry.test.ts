import { describe, it, expect } from "vitest";
import { param } from "@vexnor/core";
import { collection } from "#src/collection.js";
import { MongoQueryRegistry, serializeMongoManifest } from "#src/registry.js";
import { MONGODB_PLUGIN_NAME } from "#src/mongo-query.js";

const orders = collection("orders", {
   source: "@myapp/api:events",
   schema: {
      _id: "string",
      status: "string",
      total: "number",
   },
});

describe("MongoQueryRegistry", () => {
   it("registers queries and retrieves them", async () => {
      const registry = new MongoQueryRegistry();
      const findShipped = orders.find({ status: "shipped" });

      await registry.register({ findShipped });

      const registered = registry.getRegisteredQueries();
      expect(registered).toHaveLength(1);
      expect(registered[0]!.name).toBe("findShipped");
      expect(registered[0]!.plugin).toBe(MONGODB_PLUGIN_NAME);
   });

   it("registers multiple queries", async () => {
      const registry = new MongoQueryRegistry();
      const limitParam = param<{ limit: number }>("limit");
      const findShipped = orders.find({ status: "shipped" });
      const findDelivered = orders.find({ status: "delivered" }, { limit: limitParam });

      await registry.register({ findShipped, findDelivered });

      const registered = registry.getRegisteredQueries();
      expect(registered).toHaveLength(2);
   });

   it("checkAuthorization does not throw for queries without auth", () => {
      const registry = new MongoQueryRegistry();
      expect(() => registry.checkAuthorization()).not.toThrow();
   });
});

describe("serializeMongoManifest", () => {
   it("produces a valid manifest structure", async () => {
      const limitParam = param<{ limit: number }>("limit");
      const findShipped = orders.find({ status: "shipped" }, { limit: limitParam });
      const findAll = orders.find({});

      const manifest = await serializeMongoManifest({ findShipped, findAll });

      expect(manifest.version).toBe(1);
      expect(manifest.dialect).toBe("mongodb");
      expect(Object.keys(manifest.queries)).toHaveLength(2);
   });

   it("includes descriptor, params, schema in manifest entries", async () => {
      const limitParam = param<{ limit: number }>("limit");
      const findShipped = orders.find({ status: "shipped" }, { limit: limitParam });

      const manifest = await serializeMongoManifest({ findShipped });
      const hash = await findShipped.hash;
      const entry = manifest.queries[hash]!;

      expect(entry.name).toBe("findShipped");
      expect(entry.hash).toBe(hash);
      expect(entry.descriptor).toMatchInlineSnapshot(`
        {
          "collection": "orders",
          "filter": {
            "status": {
              "$literal": "shipped",
            },
          },
          "limit": {
            "$param": "limit",
          },
          "operation": "find",
        }
      `);
      expect(entry.params).toMatchInlineSnapshot(`
        {
          "limit": {
            "isContext": false,
            "name": "limit",
          },
        }
      `);
      expect(entry.schema).toMatchInlineSnapshot(`
        {
          "_id": "string",
          "status": "string",
          "total": "number",
        }
      `);
   });
});
