import { describe, expect, test } from "vitest";
import { deserialize } from "#/core/utils/sql-json-schema.js";
import type { SqlJsonSchema } from "#/core/utils/sql-json-schema.js";

describe("deserialize", () => {
   describe("primitives and empty input", () => {
      test("returns null unchanged", () => {
         expect(deserialize(null, {})).toMatchInlineSnapshot(`null`);
      });

      test("returns string unchanged", () => {
         expect(deserialize("string", {})).toMatchInlineSnapshot(`"string"`);
      });

      test("returns number unchanged", () => {
         expect(deserialize(42, {})).toMatchInlineSnapshot(`42`);
      });

      test("returns empty object unchanged with empty schema", () => {
         expect(deserialize({}, {})).toMatchInlineSnapshot(`{}`);
      });

      test("returns empty array unchanged", () => {
         expect(deserialize([], {})).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("Date conversion", () => {
      test("converts Date string to Date instance", () => {
         const schema: SqlJsonSchema = { createdAt: "Date" };
         const result = deserialize({ createdAt: "2001-05-30T10:40:50.867Z", email: "a@b.com" }, schema);
         expect(result).toMatchInlineSnapshot(`
           {
             "createdAt": 2001-05-30T10:40:50.867Z,
             "email": "a@b.com",
           }
         `);
         expect(result.createdAt).toBeInstanceOf(Date);
      });

      test("converts multiple Date fields", () => {
         const schema: SqlJsonSchema = { createdAt: "Date", modifiedAt: "Date" };
         const result = deserialize(
            { createdAt: "2001-05-30T10:40:50.867Z", modifiedAt: "2010-01-15T08:00:00.000Z", email: "a@b.com" },
            schema,
         );
         expect(result).toMatchInlineSnapshot(`
           {
             "createdAt": 2001-05-30T10:40:50.867Z,
             "email": "a@b.com",
             "modifiedAt": 2010-01-15T08:00:00.000Z,
           }
         `);
         expect(result.createdAt).toBeInstanceOf(Date);
         expect(result.modifiedAt).toBeInstanceOf(Date);
      });

      test("leaves null Date field as null", () => {
         const schema: SqlJsonSchema = { createdAt: "Date" };
         expect(deserialize({ createdAt: null }, schema)).toMatchInlineSnapshot(`
           {
             "createdAt": null,
           }
         `);
      });

      test("passes through already-deserialized Date instance unchanged", () => {
         const schema: SqlJsonSchema = { createdAt: "Date" };
         const date = new Date("2001-05-30T10:40:50.867Z");
         const result = deserialize({ createdAt: date }, schema);
         expect(result.createdAt).toBeInstanceOf(Date);
         expect((result.createdAt as Date).toISOString()).toBe("2001-05-30T10:40:50.867Z");
      });

      test("skips fields not in schema", () => {
         const schema: SqlJsonSchema = { createdAt: "Date" };
         const result = deserialize({ createdAt: "2001-05-30T10:40:50.867Z", name: "Bob", age: 30 }, schema);
         expect(result).toMatchInlineSnapshot(`
           {
             "age": 30,
             "createdAt": 2001-05-30T10:40:50.867Z,
             "name": "Bob",
           }
         `);
      });
   });

   describe("nested object — plain object in schema", () => {
      test("converts Date fields inside nested object", () => {
         const schema: SqlJsonSchema = {
            lastOrder: { createdAt: "Date" },
         };
         const result = deserialize(
            { lastOrder: { orderId: "123", createdAt: "2001-05-30T10:40:50.867Z" } },
            schema,
         );
         expect(result).toMatchInlineSnapshot(`
           {
             "lastOrder": {
               "createdAt": 2001-05-30T10:40:50.867Z,
               "orderId": "123",
             },
           }
         `);
         expect((result.lastOrder as { createdAt: unknown }).createdAt).toBeInstanceOf(Date);
      });

      test("handles null nested object", () => {
         const schema: SqlJsonSchema = {
            lastOrder: { createdAt: "Date" },
         };
         expect(deserialize({ lastOrder: null }, schema)).toMatchInlineSnapshot(`
           {
             "lastOrder": null,
           }
         `);
      });

      test("combines top-level and nested Date fields", () => {
         const schema: SqlJsonSchema = {
            createdAt: "Date",
            lastOrder: { createdAt: "Date" },
         };
         const result = deserialize(
            {
               createdAt: "2001-05-30T10:40:50.867Z",
               lastOrder: { orderId: "123", createdAt: "2006-05-30T10:40:50.867Z" },
            },
            schema,
         );
         expect(result).toMatchInlineSnapshot(`
           {
             "createdAt": 2001-05-30T10:40:50.867Z,
             "lastOrder": {
               "createdAt": 2006-05-30T10:40:50.867Z,
               "orderId": "123",
             },
           }
         `);
      });
   });

   describe("array — tuple [schema] in schema", () => {
      test("converts Date fields in all array items", () => {
         const schema: SqlJsonSchema = {
            orders: [{ createdAt: "Date" }],
         };
         const result = deserialize(
            {
               orders: [
                  { orderId: "1", createdAt: "2001-05-30T10:40:50.867Z" },
                  { orderId: "2", createdAt: "2006-05-30T10:40:50.867Z" },
               ],
            },
            schema,
         );
         expect(result).toMatchInlineSnapshot(`
           {
             "orders": [
               {
                 "createdAt": 2001-05-30T10:40:50.867Z,
                 "orderId": "1",
               },
               {
                 "createdAt": 2006-05-30T10:40:50.867Z,
                 "orderId": "2",
               },
             ],
           }
         `);
      });

      test("handles empty array", () => {
         const schema: SqlJsonSchema = {
            orders: [{ createdAt: "Date" }],
         };
         expect(deserialize({ orders: [] }, schema)).toMatchInlineSnapshot(`
           {
             "orders": [],
           }
         `);
      });

      test("handles null array field", () => {
         const schema: SqlJsonSchema = {
            orders: [{ createdAt: "Date" }],
         };
         expect(deserialize({ orders: null }, schema)).toMatchInlineSnapshot(`
           {
             "orders": null,
           }
         `);
      });

      test("handles top-level array of rows", () => {
         const schema: SqlJsonSchema = { createdAt: "Date" };
         const result = deserialize(
            [
               { email: "a@b.com", createdAt: "2001-05-30T10:40:50.867Z" },
               { email: "c@d.com", createdAt: "2006-05-30T10:40:50.867Z" },
            ],
            schema,
         );
         expect(result).toMatchInlineSnapshot(`
           [
             {
               "createdAt": 2001-05-30T10:40:50.867Z,
               "email": "a@b.com",
             },
             {
               "createdAt": 2006-05-30T10:40:50.867Z,
               "email": "c@d.com",
             },
           ]
         `);
      });
   });

   describe("deeply nested", () => {
      test("array of objects with nested array", () => {
         const schema: SqlJsonSchema = {
            createdAt: "Date",
            orders: [{ createdAt: "Date", items: [{ createdAt: "Date" }] }],
         };
         const result = deserialize(
            {
               createdAt: "2000-01-01T00:00:00.000Z",
               orders: [
                  {
                     createdAt: "2001-05-30T10:40:50.867Z",
                     items: [
                        { createdAt: "2003-05-30T10:40:50.867Z" },
                        { createdAt: "2004-05-30T10:40:50.867Z" },
                     ],
                  },
               ],
            },
            schema,
         );
         expect(result).toMatchInlineSnapshot(`
           {
             "createdAt": 2000-01-01T00:00:00.000Z,
             "orders": [
               {
                 "createdAt": 2001-05-30T10:40:50.867Z,
                 "items": [
                   {
                     "createdAt": 2003-05-30T10:40:50.867Z,
                   },
                   {
                     "createdAt": 2004-05-30T10:40:50.867Z,
                   },
                 ],
               },
             ],
           }
         `);
      });

      test("object inside array inside object", () => {
         const schema: SqlJsonSchema = {
            account: { orders: [{ createdAt: "Date" }] },
         };
         const result = deserialize(
            {
               account: {
                  orders: [{ orderId: "1", createdAt: "2001-05-30T10:40:50.867Z" }],
               },
            },
            schema,
         );
         expect(result).toMatchInlineSnapshot(`
           {
             "account": {
               "orders": [
                 {
                   "createdAt": 2001-05-30T10:40:50.867Z,
                   "orderId": "1",
                 },
               ],
             },
           }
         `);
      });
   });

   describe("JSON string parsing — object/array schema with string value", () => {
      const DATE_STR = "2001-05-30T10:40:50.867Z";
      test("parses JSON string into object when schema says object", () => {
         const schema: SqlJsonSchema = {
            lastOrder: { createdAt: "Date" },
         };
         const result = deserialize(
            { lastOrder: JSON.stringify({ orderId: "1", createdAt: DATE_STR }) },
            schema,
         );
         expect(result).toMatchInlineSnapshot(`
           {
             "lastOrder": {
               "createdAt": 2001-05-30T10:40:50.867Z,
               "orderId": "1",
             },
           }
         `);
      });

      test("parses JSON string into array when schema says array", () => {
         const schema: SqlJsonSchema = {
            orders: [{ createdAt: "Date" }],
         };
         const result = deserialize(
            { orders: JSON.stringify([{ orderId: "1", createdAt: DATE_STR }, { orderId: "2", createdAt: DATE_STR }]) },
            schema,
         );
         expect(result).toMatchInlineSnapshot(`
           {
             "orders": [
               {
                 "createdAt": 2001-05-30T10:40:50.867Z,
                 "orderId": "1",
               },
               {
                 "createdAt": 2001-05-30T10:40:50.867Z,
                 "orderId": "2",
               },
             ],
           }
         `);
      });

      test("handles null JSON string for object schema", () => {
         const schema: SqlJsonSchema = {
            lastOrder: { createdAt: "Date" },
         };
         expect(deserialize({ lastOrder: "null" }, schema)).toMatchInlineSnapshot(`
           {
             "lastOrder": "null",
           }
         `);
      });

      test("handles empty array JSON string", () => {
         const schema: SqlJsonSchema = {
            orders: [{ createdAt: "Date" }],
         };
         expect(deserialize({ orders: "[]" }, schema)).toMatchInlineSnapshot(`
           {
             "orders": [],
           }
         `);
      });

      test("parses nested JSON string — array inside object", () => {
         const schema: SqlJsonSchema = {
            account: { orders: [{ createdAt: "Date" }] },
         };
         const result = deserialize(
            { account: JSON.stringify({ orders: [{ orderId: "1", createdAt: DATE_STR }] }) },
            schema,
         );
         expect(result).toMatchInlineSnapshot(`
           {
             "account": {
               "orders": [
                 {
                   "createdAt": 2001-05-30T10:40:50.867Z,
                   "orderId": "1",
                 },
               ],
             },
           }
         `);
      });
   });

   describe("immutability", () => {
      test("does not mutate original object", () => {
         const schema: SqlJsonSchema = { createdAt: "Date" };
         const original = { createdAt: "2001-05-30T10:40:50.867Z" };
         deserialize(original, schema);
         expect(original.createdAt).toBe("2001-05-30T10:40:50.867Z");
      });

      test("does not mutate nested objects", () => {
         const schema: SqlJsonSchema = { order: { createdAt: "Date" } };
         const original = { order: { createdAt: "2001-05-30T10:40:50.867Z" } };
         deserialize(original, schema);
         expect(original.order.createdAt).toBe("2001-05-30T10:40:50.867Z");
      });

      test("does not mutate array items", () => {
         const schema: SqlJsonSchema = { orders: [{ createdAt: "Date" }] };
         const original = { orders: [{ createdAt: "2001-05-30T10:40:50.867Z" }] };
         deserialize(original, schema);
         expect(original.orders[0]!.createdAt).toBe("2001-05-30T10:40:50.867Z");
      });
   });
});
