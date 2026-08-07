import { describe, it, expect } from "vitest";
import {
   jsonSchemaToDescriptor,
   inferSchemaFromDocuments,
   generateCollectionFile,
} from "#src/codegen.js";

describe("jsonSchemaToDescriptor", () => {
   it("converts simple scalar types", () => {
      const schema = {
         properties: {
            name: { bsonType: "string" },
            age: { bsonType: "int" },
            score: { bsonType: "double" },
            active: { bsonType: "bool" },
            createdAt: { bsonType: "date" },
         },
      };

      const result = jsonSchemaToDescriptor(schema);
      expect(result).toMatchInlineSnapshot(`
        {
          "active": "boolean",
          "age": "integer",
          "createdAt": "date",
          "name": "string",
          "score": "number",
        }
      `);
   });

   it("converts nested objects", () => {
      const schema = {
         properties: {
            address: {
               bsonType: "object",
               properties: {
                  street: { bsonType: "string" },
                  city: { bsonType: "string" },
               },
            },
         },
      };

      const result = jsonSchemaToDescriptor(schema);
      expect(result).toMatchInlineSnapshot(`
        {
          "address": {
            "city": "string",
            "street": "string",
          },
        }
      `);
   });

   it("converts arrays of objects", () => {
      const schema = {
         properties: {
            items: {
               bsonType: "array",
               items: {
                  bsonType: "object",
                  properties: {
                     name: { bsonType: "string" },
                     qty: { bsonType: "int" },
                  },
               },
            },
         },
      };

      const result = jsonSchemaToDescriptor(schema);
      expect(result).toMatchInlineSnapshot(`
        {
          "items": [
            {
              "name": "string",
              "qty": "integer",
            },
          ],
        }
      `);
   });

   it("converts arrays of scalars", () => {
      const schema = {
         properties: {
            tags: {
               bsonType: "array",
               items: { bsonType: "string" },
            },
         },
      };

      const result = jsonSchemaToDescriptor(schema);
      expect(result).toMatchInlineSnapshot(`
        {
          "tags": [
            "string",
          ],
        }
      `);
   });

   it("handles objectId as string", () => {
      const schema = {
         properties: {
            _id: { bsonType: "objectId" },
         },
      };

      const result = jsonSchemaToDescriptor(schema);
      expect(result).toMatchInlineSnapshot(`
        {
          "_id": "string",
        }
      `);
   });

   it("handles empty schema", () => {
      const result = jsonSchemaToDescriptor({});
      expect(result).toMatchInlineSnapshot(`{}`);
   });
});

describe("inferSchemaFromDocuments", () => {
   it("infers schema from simple documents", () => {
      const docs = [
         { _id: "1", name: "Alice", age: 30, active: true },
         { _id: "2", name: "Bob", age: 25, active: false },
      ];

      const result = inferSchemaFromDocuments(docs);
      expect(result).toMatchInlineSnapshot(`
        {
          "_id": "string",
          "active": "boolean",
          "age": "number",
          "name": "string",
        }
      `);
   });

   it("infers nested objects", () => {
      const docs = [
         { address: { street: "123 Main", city: "NYC" } },
      ];

      const result = inferSchemaFromDocuments(docs);
      expect(result).toMatchInlineSnapshot(`
        {
          "address": {
            "city": "string",
            "street": "string",
          },
        }
      `);
   });

   it("infers arrays of objects", () => {
      const docs = [
         { items: [{ name: "Widget", qty: 5 }] },
      ];

      const result = inferSchemaFromDocuments(docs);
      expect(result).toMatchInlineSnapshot(`
        {
          "items": [
            {
              "name": "string",
              "qty": "number",
            },
          ],
        }
      `);
   });

   it("infers arrays of scalars", () => {
      const docs = [{ tags: ["red", "blue"] }];

      const result = inferSchemaFromDocuments(docs);
      expect(result).toMatchInlineSnapshot(`
        {
          "tags": [
            "string",
          ],
        }
      `);
   });

   it("handles Date instances", () => {
      const docs = [{ createdAt: new Date("2024-01-01") }];

      const result = inferSchemaFromDocuments(docs);
      expect(result).toMatchInlineSnapshot(`
        {
          "createdAt": "date",
        }
      `);
   });

   it("handles empty document array", () => {
      const result = inferSchemaFromDocuments([]);
      expect(result).toMatchInlineSnapshot(`{}`);
   });

   it("skips null values", () => {
      const docs = [
         { name: "Alice", notes: null },
         { name: "Bob", notes: "something" },
      ];

      const result = inferSchemaFromDocuments(docs);
      expect(result.name).toBe("string");
      expect(result.notes).toBe("string");
   });
});

describe("generateCollectionFile", () => {
   it("generates a valid TypeScript file", () => {
      const schema = {
         _id: "string" as const,
         name: "string" as const,
         age: "integer" as const,
         active: "boolean" as const,
      };

      const result = generateCollectionFile("users", schema, "@myapp/api:models");
      expect(result).toMatchInlineSnapshot(`
        "// Generated by @vexnor/mongodb codegen — do not edit
        import { collection } from '@vexnor/mongodb';

        export interface IUsers {
          _id: string;
          name: string;
          age: number;
          active: boolean;
        }

        export const Users = collection<IUsers>('users', {
          source: '@myapp/api:models',
          schema: {
            _id: 'string',
            name: 'string',
            age: 'integer',
            active: 'boolean',
          },
        });
        "
      `);
   });

   it("generates nested schemas", () => {
      const schema = {
         _id: "string" as const,
         address: { street: "string" as const, city: "string" as const },
         tags: ["string"] as ["string"],
      };

      const result = generateCollectionFile("orders", schema, "@myapp/api:orders");
      expect(result).toContain("address: { street: string; city: string }");
      expect(result).toContain("tags: string[]");
   });
});
