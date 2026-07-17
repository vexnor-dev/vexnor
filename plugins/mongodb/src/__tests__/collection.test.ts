import { describe, it, expect } from "vitest";
import { collection, isMongoCollection, COLLECTION_REF } from "#src/collection.js";
import type { SchemaDescriptor } from "#src/schema-descriptor.js";

interface TestDoc {
   _id: string;
   name: string;
   age: number;
   active: boolean;
   createdAt: Date;
}

const testSchema: SchemaDescriptor = {
   _id: "string",
   name: "string",
   age: "integer",
   active: "boolean",
   createdAt: "date",
};

describe("collection", () => {
   it("creates a collection with correct properties", () => {
      const col = collection<TestDoc>("users", {
         source: "@myapp/api:models",
         schema: testSchema,
      });

      expect(col.collectionName).toBe("users");
      expect(col.source).toBe("@myapp/api:models");
      expect(col.schema).toStrictEqual(testSchema);
      expect(col[COLLECTION_REF]).toBe(true);
   });

   it("isMongoCollection identifies collection refs", () => {
      const col = collection<TestDoc>("users", {
         source: "@myapp/api:models",
         schema: testSchema,
      });

      expect(isMongoCollection(col)).toBe(true);
      expect(isMongoCollection({})).toBe(false);
      expect(isMongoCollection(null)).toBe(false);
      expect(isMongoCollection("not a collection")).toBe(false);
   });

   it("provides find, aggregate, deleteOne, insertOne, updateOne methods", () => {
      const col = collection<TestDoc>("users", {
         source: "@myapp/api:models",
         schema: testSchema,
      });

      expect(typeof col.find).toBe("function");
      expect(typeof col.aggregate).toBe("function");
      expect(typeof col.deleteOne).toBe("function");
      expect(typeof col.deleteMany).toBe("function");
      expect(typeof col.insertOne).toBe("function");
      expect(typeof col.insertMany).toBe("function");
      expect(typeof col.updateOne).toBe("function");
      expect(typeof col.updateMany).toBe("function");
   });

   it("find returns a MongoQuery", () => {
      const col = collection<TestDoc>("users", {
         source: "@myapp/api:models",
         schema: testSchema,
      });

      const query = col.find({ active: true });
      expect(query.collectionName).toBe("users");
      expect(query.operation).toBe("find");
      expect(query.source).toBe("@myapp/api:models");
   });

   it("aggregate returns a MongoQuery", () => {
      const col = collection<TestDoc>("users", {
         source: "@myapp/api:models",
         schema: testSchema,
      });

      const query = col.aggregate([{ $match: { active: true } }]);
      expect(query.collectionName).toBe("users");
      expect(query.operation).toBe("aggregate");
   });

   it("deleteOne returns a MongoQuery", () => {
      const col = collection<TestDoc>("users", {
         source: "@myapp/api:models",
         schema: testSchema,
      });

      const query = col.deleteOne({ _id: "123" });
      expect(query.operation).toBe("deleteOne");
   });

   it("insertOne returns a MongoQuery", () => {
      const col = collection<TestDoc>("users", {
         source: "@myapp/api:models",
         schema: testSchema,
      });

      const query = col.insertOne({ _id: "1", name: "Test", age: 25, active: true, createdAt: new Date() });
      expect(query.operation).toBe("insertOne");
   });

   it("updateOne returns a MongoQuery", () => {
      const col = collection<TestDoc>("users", {
         source: "@myapp/api:models",
         schema: testSchema,
      });

      const query = col.updateOne({ _id: "1" }, { $set: { name: "Updated" } });
      expect(query.operation).toBe("updateOne");
   });

   it("supports nested schema descriptors", () => {
      interface NestedDoc {
         _id: string;
         address: { street: string; city: string; geo: { lat: number; lng: number } };
         tags: string[];
         items: { name: string; qty: number }[];
      }

      const schema: SchemaDescriptor = {
         _id: "string",
         address: {
            street: "string",
            city: "string",
            geo: { lat: "number", lng: "number" },
         },
         tags: ["string"],
         items: [{ name: "string", qty: "integer" }],
      };

      const col = collection<NestedDoc>("orders", {
         source: "@myapp/api:orders",
         schema,
      });

      expect(col.schema).toStrictEqual(schema);
   });
});
