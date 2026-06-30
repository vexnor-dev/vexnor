import { describe, expect, test } from "vitest";
import { serializeSchema } from "#src/core/serialize/serialize-schema.js";
import { newSqlTable, type SqlTableForeignKey } from "#src/core/schema/sql-table.js";

function makeTable(
   name: string,
   columns: Record<string, string>,
   opts?: {
      fk?: SqlTableForeignKey[];
      pk?: string[];
      schema?: string;
      dbSchema?: Record<string, { dbType: string; nullable?: boolean }>;
   },
) {
   return newSqlTable<{
      Select: Record<string, unknown>;
      Insert: Record<string, unknown>;
      Update: Record<string, unknown>;
      Delete: true;
   }>({
      crud: { select: true, insert: true, update: true, delete: true },
      tableInfo: { name, schema: opts?.schema ?? "public", alias: null, out: false },
      pk: (opts?.pk ?? ["id"]) as never[],
      fk: opts?.fk,
      columns: columns as never,
      dbSchema: opts?.dbSchema as never,
   });
}

describe("serializeSchema", () => {
   const Payment = makeTable(
      "payment",
      { paymentId: "payment_id", customerId: "customer_id", amount: "amount" },
      {
         pk: ["paymentId"],
         fk: [{ from: ["customerId"], to: { schema: "public", table: "customer", columns: ["customerId"] } }],
         dbSchema: {
            paymentId: { dbType: "integer" },
            customerId: { dbType: "integer", nullable: true },
            amount: { dbType: "numeric", nullable: true },
         },
      },
   );

   const Customer = makeTable(
      "customer",
      { customerId: "customer_id", addressId: "address_id", firstName: "first_name" },
      {
         pk: ["customerId"],
         fk: [{ from: ["addressId"], to: { schema: "public", table: "address", columns: ["addressId"] } }],
         dbSchema: {
            customerId: { dbType: "integer" },
            addressId: { dbType: "integer" },
            firstName: { dbType: "varchar" },
         },
      },
   );

   const Address = makeTable(
      "address",
      { addressId: "address_id", cityId: "city_id" },
      {
         pk: ["addressId"],
         fk: [{ from: ["cityId"], to: { schema: "public", table: "city", columns: ["cityId"] } }],
         dbSchema: {
            addressId: { dbType: "integer" },
            cityId: { dbType: "integer" },
         },
      },
   );

   const City = makeTable(
      "city",
      { cityId: "city_id", city: "city" },
      {
         pk: ["cityId"],
         dbSchema: {
            cityId: { dbType: "integer" },
            city: { dbType: "varchar" },
         },
      },
   );

   test("produces full schema manifest with tables, columns, PKs, FKs", () => {
      const schema = { Payment, Customer, Address, City };
      const result = serializeSchema(schema, "postgresql");

      expect(result).toMatchInlineSnapshot(`
        {
          "dialect": "postgresql",
          "tables": {
            "public.address": {
              "columns": [
                {
                  "name": "addressId",
                  "type": "integer",
                },
                {
                  "name": "cityId",
                  "type": "integer",
                },
              ],
              "fk": [
                {
                  "column": "cityId",
                  "targetColumn": "cityId",
                  "targetTable": "public.city",
                },
              ],
              "pk": [
                "addressId",
              ],
            },
            "public.city": {
              "columns": [
                {
                  "name": "cityId",
                  "type": "integer",
                },
                {
                  "name": "city",
                  "type": "varchar",
                },
              ],
              "fk": [],
              "pk": [
                "cityId",
              ],
            },
            "public.customer": {
              "columns": [
                {
                  "name": "customerId",
                  "type": "integer",
                },
                {
                  "name": "addressId",
                  "type": "integer",
                },
                {
                  "name": "firstName",
                  "type": "varchar",
                },
              ],
              "fk": [
                {
                  "column": "addressId",
                  "targetColumn": "addressId",
                  "targetTable": "public.address",
                },
              ],
              "pk": [
                "customerId",
              ],
            },
            "public.payment": {
              "columns": [
                {
                  "name": "paymentId",
                  "type": "integer",
                },
                {
                  "name": "customerId",
                  "nullable": true,
                  "type": "integer",
                },
                {
                  "name": "amount",
                  "nullable": true,
                  "type": "numeric",
                },
              ],
              "fk": [
                {
                  "column": "customerId",
                  "targetColumn": "customerId",
                  "targetTable": "public.customer",
                },
              ],
              "pk": [
                "paymentId",
              ],
            },
          },
          "version": 1,
        }
      `);
   });

   test("excludes tables without PKs (views)", () => {
      const SalesView = newSqlTable<{
         Select: { total: number };
         Insert: Record<string, unknown>;
         Update: Record<string, unknown>;
         Delete: true;
      }>({
         crud: { select: true, insert: true, update: true, delete: true },
         tableInfo: { name: "sales_view", schema: "public", alias: null, out: false },
         pk: [] as never[],
         columns: { total: "total" } as never,
      });

      const schema = { Payment, SalesView };
      const result = serializeSchema(schema, "postgresql");

      expect(Object.keys(result.tables)).toMatchInlineSnapshot(`
        [
          "public.payment",
        ]
      `);
   });

   test("excludes partition tables", () => {
      const Partition = makeTable("payment_p2007_01", { id: "id" }, { pk: ["id"] });

      const schema = { Payment, Partition };
      const result = serializeSchema(schema, "postgresql");

      expect(Object.keys(result.tables)).toMatchInlineSnapshot(`
        [
          "public.payment",
        ]
      `);
   });

   test("excludes _p0000 partition tables", () => {
      const Partition = makeTable("data_p0000", { id: "id" }, { pk: ["id"] });

      const schema = { Payment, Partition };
      const result = serializeSchema(schema, "postgresql");

      expect(Object.keys(result.tables)).toMatchInlineSnapshot(`
        [
          "public.payment",
        ]
      `);
   });

   test("skips non-table values in schema object", () => {
      const schema = { Payment, notATable: "hello", alsoNot: 42, nullVal: null };
      const result = serializeSchema(schema, "postgresql");

      expect(Object.keys(result.tables)).toMatchInlineSnapshot(`
        [
          "public.payment",
        ]
      `);
   });

   test("falls back to 'unknown' type when dbSchema is missing", () => {
      const Bare = makeTable("bare", { id: "id", name: "name" }, { pk: ["id"] });

      const schema = { Bare };
      const result = serializeSchema(schema, "sqlite");

      expect(result).toMatchInlineSnapshot(`
        {
          "dialect": "sqlite",
          "tables": {
            "public.bare": {
              "columns": [
                {
                  "name": "id",
                  "type": "unknown",
                },
                {
                  "name": "name",
                  "type": "unknown",
                },
              ],
              "fk": [],
              "pk": [
                "id",
              ],
            },
          },
          "version": 1,
        }
      `);
   });

   test("uses table schema as FK target schema when FK.to.schema is empty", () => {
      const Order = makeTable(
         "order",
         { orderId: "order_id", accountId: "account_id" },
         {
            schema: "myschema",
            pk: ["orderId"],
            fk: [{ from: ["accountId"], to: { schema: "", table: "account", columns: ["accountId"] } }],
            dbSchema: {
               orderId: { dbType: "uuid" },
               accountId: { dbType: "uuid" },
            },
         },
      );

      const schema = { Order };
      const result = serializeSchema(schema, "postgresql");

      expect(result.tables["myschema.order"]!.fk).toMatchInlineSnapshot(`
        [
          {
            "column": "accountId",
            "targetColumn": "accountId",
            "targetTable": "myschema.account",
          },
        ]
      `);
   });

   test("sorts tables alphabetically by qualified name", () => {
      const schema = { City, Payment, Address, Customer };
      const result = serializeSchema(schema, "postgresql");

      expect(Object.keys(result.tables)).toMatchInlineSnapshot(`
        [
          "public.address",
          "public.city",
          "public.customer",
          "public.payment",
        ]
      `);
   });

   test("handles composite primary keys", () => {
      const OrderItem = makeTable(
         "order_item",
         { orderId: "order_id", productId: "product_id", quantity: "quantity" },
         {
            pk: ["orderId", "productId"],
            fk: [
               { from: ["orderId"], to: { schema: "public", table: "order", columns: ["orderId"] } },
               { from: ["productId"], to: { schema: "public", table: "product", columns: ["productId"] } },
            ],
            dbSchema: {
               orderId: { dbType: "uuid" },
               productId: { dbType: "uuid" },
               quantity: { dbType: "integer" },
            },
         },
      );

      const schema = { OrderItem };
      const result = serializeSchema(schema, "postgresql");

      expect(result.tables["public.order_item"]).toMatchInlineSnapshot(`
        {
          "columns": [
            {
              "name": "orderId",
              "type": "uuid",
            },
            {
              "name": "productId",
              "type": "uuid",
            },
            {
              "name": "quantity",
              "type": "integer",
            },
          ],
          "fk": [
            {
              "column": "orderId",
              "targetColumn": "orderId",
              "targetTable": "public.order",
            },
            {
              "column": "productId",
              "targetColumn": "productId",
              "targetTable": "public.product",
            },
          ],
          "pk": [
            "orderId",
            "productId",
          ],
        }
      `);
   });

   test("defaults to 'public' schema when tableInfo.schema is undefined", () => {
      const NoSchema = newSqlTable<{
         Select: Record<string, unknown>;
         Insert: Record<string, unknown>;
         Update: Record<string, unknown>;
         Delete: true;
      }>({
         crud: { select: true, insert: true, update: true, delete: true },
         tableInfo: { name: "no_schema", schema: undefined as unknown as string, alias: null, out: false },
         pk: ["id"] as never[],
         columns: { id: "id" } as never,
         dbSchema: { id: { dbType: "integer" } } as never,
      });

      const schema = { NoSchema };
      const result = serializeSchema(schema, "postgresql");

      expect(Object.keys(result.tables)).toMatchInlineSnapshot(`
        [
          "public.no_schema",
        ]
      `);
   });

   test("empty schema produces empty tables", () => {
      const result = serializeSchema({}, "postgresql");

      expect(result).toMatchInlineSnapshot(`
        {
          "dialect": "postgresql",
          "tables": {},
          "version": 1,
        }
      `);
   });

   test("works with transactsql dialect", () => {
      const schema = { City };
      const result = serializeSchema(schema, "transactsql");

      expect(result.version).toBe(1);
      expect(result.dialect).toBe("transactsql");
      expect(Object.keys(result.tables)).toMatchInlineSnapshot(`
        [
          "public.city",
        ]
      `);
   });
});
