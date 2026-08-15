import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { param, row, val } from "@vexnor/core";
import { sql, unnest } from "@vexnor/duckdb";
import { DocumentOrder, IDocumentOrderInsert } from "./codegen/main.document_order-table.js";
import { db } from "./config.js";

type ParameterizedOrder = Pick<
   IDocumentOrderInsert,
   "documentId" | "account" | "status" | "shipping" | "items" | "tags" | "createdAt"
>;

const Orders = DocumentOrder.as("orders");
const Items = unnest(Orders.$items).as("item");
const Discounts = unnest(Items.$discounts).as("discount");

const insertParameterizedOrder = sql`
   insert into ${DocumentOrder} (
      ${DocumentOrder.$documentId},
      ${DocumentOrder.$account},
      ${DocumentOrder.$status},
      ${DocumentOrder.$shipping},
      ${DocumentOrder.$items},
      ${DocumentOrder.$tags},
      ${DocumentOrder.$createdAt}
   )
   values (
      ${param<Pick<ParameterizedOrder, "documentId">>("documentId")},
      ${param<Pick<ParameterizedOrder, "account">>("account")},
      ${param<Pick<ParameterizedOrder, "status">>("status")},
      ${param<Pick<ParameterizedOrder, "shipping">>("shipping")},
      ${param<Pick<ParameterizedOrder, "items">>("items")},
      ${param<Pick<ParameterizedOrder, "tags">>("tags")},
      ${param<Pick<ParameterizedOrder, "createdAt">>("createdAt")}
   )
`;

const selectParameterizedOrder = sql`
   select ${row(
      Orders.$documentId.as("orderId"),
      Orders.$tags,
      Items.$product.$productId.as("productId"),
      Items.$discounts,
   )}
   from ${Orders}, ${Items}
   where ${Orders.$documentId} = ${param<{ documentId: string }>("documentId")}
`;

const selectNestedOrders = sql`
   select ${row(
      Orders.$documentId.as("orderId"),
      Orders.$account.$accountId.as("accountId"),
      Orders.$account.$email.as("accountEmail"),
      Orders.$account.$status.as("accountStatus"),
      Orders.$shipping.$address.$country.as("shippingCountry"),
      Orders.$shipping.$address.$geo.$latitude.as("shippingLatitude"),
      Orders.$shipping.$carrier.$name.as("carrier"),
      Orders.$status,
      Orders.$tags,
      Orders.$createdAt,
   )}
   from ${Orders}
   order by ${Orders.$documentId}
`;

const selectOrderItems = sql`
   select ${row(
      Orders.$documentId.as("orderId"),
      Items.$product.$productId.as("productId"),
      Items.$product.$label.as("productLabel"),
      Items.$product.$category.as("productCategory"),
      Items.$quantity,
      Items.$unitPrice,
      val`${Items.$quantity.raw} * ${Items.$unitPrice.raw}`.as<{ lineTotal: number | null }>("lineTotal"),
   )}
   from ${Orders}, ${Items}
   order by ${Items.$product.$productId}
`;

const selectOrderDiscounts = sql`
   select ${row(
      Orders.$documentId.as("orderId"),
      Items.$product.$productId.as("productId"),
      Discounts.$code,
      Discounts.$amount,
   )}
   from ${Orders}, ${Items}, ${Discounts}
   order by ${Items.$product.$productId}, ${Discounts.$code}
`;

describe.sequential("Vexnor DuckDB hierarchical data e2e", () => {
   beforeAll(async () => {
      await sql`delete from ${DocumentOrder}`.duckdb.run({ db });

      await sql`
         insert into ${DocumentOrder} (
            ${DocumentOrder.$documentId},
            ${DocumentOrder.$account},
            ${DocumentOrder.$status},
            ${DocumentOrder.$shipping},
            ${DocumentOrder.$items},
            ${DocumentOrder.$tags},
            ${DocumentOrder.$createdAt}
         ) values
         (
            '507f1f77bcf86cd799439021',
            {'account_id': 'account-1', 'email': 'owner@example.com', 'status': 'confirmed'},
            'paid',
            {
               'address': {
                  'street': 'Main Street 1',
                  'city': 'Berlin',
                  'country': 'DE',
                  'geo': {'latitude': 52.52, 'longitude': 13.405}
               },
               'carrier': {'name': 'DHL', 'tracking_id': 'track-1'}
            },
            [
               {
                  'product': {'product_id': 'product-1', 'label': 'Analytics Kit', 'category': 'hardware'},
                  'quantity': 2,
                  'unit_price': 60,
                  'discounts': [{'code': 'bulk', 'amount': 5}]
               },
               {
                  'product': {'product_id': 'product-2', 'label': 'DuckDB Guide', 'category': 'book'},
                  'quantity': 1,
                  'unit_price': 25,
                  'discounts': []
               }
            ],
            ['priority', 'international'],
            TIMESTAMP '2026-08-11 12:34:56.789'
         ),
         (
            'order-2',
            {'account_id': 'account-2', 'email': 'new@example.com', 'status': 'created'},
            'created',
            NULL,
            [],
            [],
            TIMESTAMP '2026-08-12 00:00:00'
         )
      `.duckdb.run({ db });
   });

   afterAll(async () => {
      await sql`delete from ${DocumentOrder}`.duckdb.run({ db });
   });

   test("queries nested account and shipping fields through Vexnor", async () => {
      const result = await selectNestedOrders.duckdb.all({ db });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "accountEmail": "owner@example.com",
            "accountId": "account-1",
            "accountStatus": "confirmed",
            "carrier": "DHL",
            "createdAt": 2026-08-11T12:34:56.789Z,
            "orderId": "507f1f77bcf86cd799439021",
            "shippingCountry": "DE",
            "shippingLatitude": 52.52,
            "status": "paid",
            "tags": [
              "priority",
              "international",
            ],
          },
          {
            "accountEmail": "new@example.com",
            "accountId": "account-2",
            "accountStatus": "created",
            "carrier": null,
            "createdAt": 2026-08-12T00:00:00.000Z,
            "orderId": "order-2",
            "shippingCountry": null,
            "shippingLatitude": null,
            "status": "created",
            "tags": [],
          },
        ]
      `);
   });

   test("expands nested product items through a Vexnor query", async () => {
      const result = await selectOrderItems.duckdb.all({ db });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "lineTotal": 120,
            "orderId": "507f1f77bcf86cd799439021",
            "productCategory": "hardware",
            "productId": "product-1",
            "productLabel": "Analytics Kit",
            "quantity": 2,
            "unitPrice": 60,
          },
          {
            "lineTotal": 25,
            "orderId": "507f1f77bcf86cd799439021",
            "productCategory": "book",
            "productId": "product-2",
            "productLabel": "DuckDB Guide",
            "quantity": 1,
            "unitPrice": 25,
          },
        ]
      `);
   });

   test("expands nested arrays through a chained Vexnor query", async () => {
      const result = await selectOrderDiscounts.duckdb.all({ db });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "amount": 5,
            "code": "bulk",
            "orderId": "507f1f77bcf86cd799439021",
            "productId": "product-1",
          },
        ]
      `);
   });

   test("writes nested lists through ordinary Vexnor parameters", async () => {
      await insertParameterizedOrder.duckdb.run({
         db,
         params: {
            documentId: "order-3",
            account: { account_id: "account-3", email: "nested@example.com", status: "confirmed" },
            status: "paid",
            shipping: null,
            items: [
               {
                  product: { product_id: "product-3", label: "Nested Data", category: "book" },
                  quantity: 1,
                  unit_price: 30,
                  discounts: [
                     { code: "launch", amount: 3 },
                     { code: "member", amount: 2 },
                  ],
               },
            ],
            tags: ["parameterized", "nested"],
            createdAt: new Date("2026-08-12T12:00:00.000Z"),
         },
      });

      const result = await selectParameterizedOrder.duckdb.all({ db, params: { documentId: "order-3" } });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "discounts": [
              {
                "amount": 3,
                "code": "launch",
              },
              {
                "amount": 2,
                "code": "member",
              },
            ],
            "orderId": "order-3",
            "productId": "product-3",
            "tags": [
              "parameterized",
              "nested",
            ],
          },
        ]
      `);
   });
});
