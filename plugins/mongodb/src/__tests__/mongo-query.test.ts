import { describe, it, expect } from "vitest";
import { param, ctx } from "@vexnor/core";
import { collection } from "#src/collection.js";
import { MongoQuery } from "#src/mongo-query.js";
import type { SchemaDescriptor } from "#src/schema-descriptor.js";

interface Order {
   _id: string;
   accountId: string;
   status: "pending" | "shipped" | "delivered";
   total: number;
   createdAt: Date;
}

const orderSchema: SchemaDescriptor = {
   _id: "string",
   accountId: "string",
   status: "string",
   total: "number",
   createdAt: "date",
};

const orders = collection<Order>("orders", {
   source: "@myapp/api:events",
   schema: orderSchema,
});

describe("MongoQuery", () => {
   describe("find", () => {
      it("constructs a find query with literal filter", () => {
         const query = orders.find({ status: "shipped" });

         expect(query.collectionName).toBe("orders");
         expect(query.operation).toBe("find");
         expect(query.source).toBe("@myapp/api:events");
         expect(query.rowSchema).toStrictEqual(orderSchema);
      });

      it("extracts params from filter", () => {
         const statusParam = param<{ status: string }>("status");
         const query = orders.find({ status: statusParam });

         expect(query.params).toMatchInlineSnapshot(`
           {
             "status": {
               "isContext": false,
               "name": "status",
             },
           }
         `);
      });

      it("extracts ctx from filter", () => {
         const userIdCtx = ctx<{ userId: string }>("userId");
         const query = orders.find({ accountId: userIdCtx });

         expect(query.params).toMatchInlineSnapshot(`
           {
             "userId": {
               "isContext": true,
               "name": "userId",
             },
           }
         `);
      });

      it("extracts params from options", () => {
         const limitParam = param<{ limit: number }>("limit");
         const query = orders.find({ status: "shipped" }, { sort: { createdAt: -1 }, limit: limitParam });

         expect(query.params.limit).toMatchInlineSnapshot(`
           {
             "isContext": false,
             "name": "limit",
           }
         `);
      });

      it("builds descriptor with $literal and $param markers", () => {
         const limitParam = param<{ limit: number }>("limit");
         const query = orders.find({ status: "shipped" }, { sort: { createdAt: -1 }, limit: limitParam });

         expect(query.descriptor).toMatchInlineSnapshot(`
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
             "sort": {
               "createdAt": -1,
             },
           }
         `);
      });

      it("produces deterministic hash", async () => {
         const query1 = orders.find({ status: "shipped" }, { limit: 10 });
         const query2 = orders.find({ status: "shipped" }, { limit: 10 });

         const hash1 = await query1.hash;
         const hash2 = await query2.hash;

         expect(hash1).toBe(hash2);
         expect(hash1).toMatch(/^[a-f0-9]{64}$/);
      });

      it("produces different hashes for different filters", async () => {
         const query1 = orders.find({ status: "shipped" });
         const query2 = orders.find({ status: "delivered" });

         const hash1 = await query1.hash;
         const hash2 = await query2.hash;

         expect(hash1).not.toBe(hash2);
      });

      it("produces different hashes for literal vs param", async () => {
         const query1 = orders.find({ status: "shipped" });
         const statusParam = param<{ status: string }>("status");
         const query2 = orders.find({ status: statusParam });

         const hash1 = await query1.hash;
         const hash2 = await query2.hash;

         expect(hash1).not.toBe(hash2);
      });

      it("hash is key-order independent", async () => {
         // Different key order but same logical filter
         const query1 = MongoQuery.find(
            collection("test", { source: "s", schema: { a: "string", b: "string" } }),
            { b: "2", a: "1" },
         );
         const query2 = MongoQuery.find(
            collection("test", { source: "s", schema: { a: "string", b: "string" } }),
            { a: "1", b: "2" },
         );

         const hash1 = await query1.hash;
         const hash2 = await query2.hash;
         expect(hash1).toBe(hash2);
      });
   });

   describe("aggregate", () => {
      it("constructs an aggregation pipeline query", () => {
         const query = orders.aggregate([
            { $match: { status: "delivered" } },
            { $group: { _id: "$accountId", total: { $sum: "$total" } } },
         ]);

         expect(query.operation).toBe("aggregate");
         expect(query.descriptor).toMatchInlineSnapshot(`
           {
             "collection": "orders",
             "operation": "aggregate",
             "pipeline": [
               {
                 "$match": {
                   "status": {
                     "$literal": "delivered",
                   },
                 },
               },
               {
                 "$group": {
                   "_id": {
                     "$literal": "$accountId",
                   },
                   "total": {
                     "$sum": {
                       "$literal": "$total",
                     },
                   },
                 },
               },
             ],
           }
         `);
      });

      it("extracts params from pipeline stages", () => {
         const statusParam = param<{ status: string }>("status");
         const query = orders.aggregate([{ $match: { status: statusParam } }]);

         expect(query.params.status).toBeDefined();
         expect(query.params.status!.isContext).toBe(false);
      });
   });

   describe("deleteOne", () => {
      it("constructs a deleteOne query", () => {
         const idParam = param<{ orderId: string }>("orderId");
         const query = orders.deleteOne({ _id: idParam });

         expect(query.operation).toBe("deleteOne");
         expect(query.params.orderId).toBeDefined();
         expect(query.rowSchema).toMatchInlineSnapshot(`
           {
             "deletedCount": "integer",
           }
         `);
      });
   });

   describe("insertOne", () => {
      it("constructs an insertOne query with param", () => {
         const docParam = param<{ doc: Order }>("doc");
         const query = orders.insertOne(docParam);

         expect(query.operation).toBe("insertOne");
         expect(query.params.doc).toBeDefined();
      });
   });

   describe("updateOne", () => {
      it("constructs an updateOne query", () => {
         const idParam = param<{ id: string }>("id");
         const query = orders.updateOne({ _id: idParam }, { $set: { status: "delivered" } });

         expect(query.operation).toBe("updateOne");
         expect(query.params.id).toBeDefined();
         expect(query.rowSchema).toMatchInlineSnapshot(`
           {
             "matchedCount": "integer",
             "modifiedCount": "integer",
           }
         `);
      });
   });

   describe("authorize", () => {
      it("adds authorization tags", () => {
         const query = orders.find({ status: "shipped" }).authorize("admin", "read:orders");

         expect(query.authorization).toMatchInlineSnapshot(`
           [
             "admin",
             "read:orders",
           ]
         `);
      });

      it("does not mutate original query", () => {
         const query = orders.find({ status: "shipped" });
         const authorized = query.authorize("admin");

         expect(query.authorization).toHaveLength(0);
         expect(authorized.authorization).toHaveLength(1);
      });
   });

   describe("collection ref in $lookup", () => {
      it("resolves collection refs to string names in descriptor", () => {
         const accounts = collection("accounts", { source: "test", schema: { _id: "string" } });
         const query = orders.aggregate([
            { $lookup: { from: accounts, localField: "accountId", foreignField: "_id", as: "account" } },
         ]);

         // The 'from' field should be resolved to the string name
         const pipeline = query.descriptor.pipeline as { $lookup: { from: string } }[];
         expect(pipeline[0]!.$lookup.from).toBe("accounts");
      });
   });
});
