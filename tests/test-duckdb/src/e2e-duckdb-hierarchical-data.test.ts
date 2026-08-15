import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { param, row, val } from "@vexnor/core";
import { sql, unnest } from "@vexnor/duckdb";
import { Account } from "./codegen/main.account-table.js";
import { Order, IOrderInsert } from "./codegen/main.order-table.js";
import { db } from "./config.js";
import { insertAccount } from "./fixtures.js";

type ParameterizedOrder = Required<
   Pick<IOrderInsert, "orderId" | "accountId" | "status" | "shipping" | "items" | "tags" | "createdAt">
>;

const FIRST_ORDER_ID = "00000000-0000-4000-8000-000000000101";
const SECOND_ORDER_ID = "00000000-0000-4000-8000-000000000102";
const PARAMETERIZED_ORDER_ID = "00000000-0000-4000-8000-000000000103";

const Orders = Order.as("orders");
const Items = unnest(Orders.$items).as("item");
const Discounts = unnest(Items.$discounts).as("discount");

const insertParameterizedOrder = sql`
   insert into ${Order} (
      ${Order.$orderId},
      ${Order.$accountId},
      ${Order.$status},
      ${Order.$shipping},
      ${Order.$items},
      ${Order.$tags},
      ${Order.$createdAt}
   )
   values (
      ${param<Pick<ParameterizedOrder, "orderId">>("orderId")},
      ${param<Pick<ParameterizedOrder, "accountId">>("accountId")},
      ${param<Pick<ParameterizedOrder, "status">>("status")},
      ${param<Pick<ParameterizedOrder, "shipping">>("shipping")},
      ${param<Pick<ParameterizedOrder, "items">>("items")},
      ${param<Pick<ParameterizedOrder, "tags">>("tags")},
      ${param<Pick<ParameterizedOrder, "createdAt">>("createdAt")}
   )
`;

const selectParameterizedOrder = sql`
   select ${row(
      Orders.$orderId,
      Orders.$tags,
      Items.$product.$productId.as("productId"),
      Items.$discounts,
   )}
   from ${Orders}, ${Items}
   where ${Orders.$orderId} = ${param<{ orderId: string }>("orderId")}
`;

const selectNestedOrders = sql`
   select ${row(
      Orders.$orderId,
      Orders.$accountId,
      Orders.$shipping.$address.$country.as("shippingCountry"),
      Orders.$shipping.$address.$geo.$latitude.as("shippingLatitude"),
      Orders.$shipping.$carrier.$name.as("carrier"),
      Orders.$status,
      Orders.$tags,
      Orders.$createdAt,
   )}
   from ${Orders}
   where ${Orders.$orderId} = ${FIRST_ORDER_ID} or ${Orders.$orderId} = ${SECOND_ORDER_ID}
   order by ${Orders.$orderId}
`;

const selectOrderItems = sql`
   select ${row(
      Orders.$orderId,
      Items.$product.$productId.as("productId"),
      Items.$product.$label.as("productLabel"),
      Items.$product.$category.as("productCategory"),
      Items.$quantity,
      Items.$unitPrice,
      val`${Items.$quantity.raw} * ${Items.$unitPrice.raw}`.as<{ lineTotal: number | null }>("lineTotal"),
   )}
   from ${Orders}, ${Items}
   where ${Orders.$orderId} = ${FIRST_ORDER_ID}
   order by ${Items.$product.$productId}
`;

const selectOrderDiscounts = sql`
   select ${row(
      Orders.$orderId,
      Items.$product.$productId.as("productId"),
      Discounts.$code,
      Discounts.$amount,
   )}
   from ${Orders}, ${Items}, ${Discounts}
   where ${Orders.$orderId} = ${FIRST_ORDER_ID}
   order by ${Items.$product.$productId}, ${Discounts.$code}
`;

describe("Vexnor DuckDB hierarchical data e2e", { concurrent: false }, () => {
   let accountId: string;

   beforeAll(async () => {
      const account = await insertAccount("hierarchical-data");
      accountId = account.accountId;

      await insertParameterizedOrder.duckdb.run({
         db,
         params: {
            orderId: FIRST_ORDER_ID,
            accountId,
            status: "paid",
            shipping: {
               address: {
                  street: "Main Street 1",
                  city: "Berlin",
                  country: "DE",
                  geo: { latitude: 52.52, longitude: 13.405 },
               },
               carrier: { name: "DHL", tracking_id: "track-1" },
            },
            items: [
               {
                  product: { product_id: "product-1", label: "Analytics Kit", category: "hardware" },
                  quantity: 2,
                  unit_price: 60,
                  discounts: [{ code: "bulk", amount: 5 }],
               },
               {
                  product: { product_id: "product-2", label: "DuckDB Guide", category: "book" },
                  quantity: 1,
                  unit_price: 25,
                  discounts: [],
               },
            ],
            tags: ["priority", "international"],
            createdAt: new Date("2026-08-11T12:34:56.789Z"),
         },
      });
      await insertParameterizedOrder.duckdb.run({
         db,
         params: {
            orderId: SECOND_ORDER_ID,
            accountId,
            status: "created",
            shipping: null,
            items: [],
            tags: [],
            createdAt: new Date("2026-08-12T00:00:00.000Z"),
         },
      });
   });

   afterAll(async () => {
      await sql`
         delete from ${Order}
         where ${Order.$orderId} = ${FIRST_ORDER_ID}
            or ${Order.$orderId} = ${SECOND_ORDER_ID}
            or ${Order.$orderId} = ${PARAMETERIZED_ORDER_ID}
      `.duckdb.run({ db });
      await sql`delete from ${Account} where ${Account.$accountId} = ${accountId}`.duckdb.run({ db });
   });

   test("queries nested shipping fields through Vexnor", async () => {
      const result = await selectNestedOrders.duckdb.all({ db });
      for (const resultRow of result) expect(resultRow.accountId).toBe(accountId);

      expect(result.map(({ accountId: _, ...stable }) => stable)).toMatchInlineSnapshot(`
        [
          {
            "carrier": "DHL",
            "createdAt": 2026-08-11T12:34:56.789Z,
            "orderId": "00000000-0000-4000-8000-000000000101",
            "shippingCountry": "DE",
            "shippingLatitude": 52.52,
            "status": "paid",
            "tags": [
              "priority",
              "international",
            ],
          },
          {
            "carrier": null,
            "createdAt": 2026-08-12T00:00:00.000Z,
            "orderId": "00000000-0000-4000-8000-000000000102",
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
            "orderId": "00000000-0000-4000-8000-000000000101",
            "productCategory": "hardware",
            "productId": "product-1",
            "productLabel": "Analytics Kit",
            "quantity": 2,
            "unitPrice": 60,
          },
          {
            "lineTotal": 25,
            "orderId": "00000000-0000-4000-8000-000000000101",
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
            "orderId": "00000000-0000-4000-8000-000000000101",
            "productId": "product-1",
          },
        ]
      `);
   });

   test("writes nested lists through ordinary Vexnor parameters", async () => {
      await insertParameterizedOrder.duckdb.run({
         db,
         params: {
            orderId: PARAMETERIZED_ORDER_ID,
            accountId,
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

      const result = await selectParameterizedOrder.duckdb.all({ db, params: { orderId: PARAMETERIZED_ORDER_ID } });

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
            "orderId": "00000000-0000-4000-8000-000000000103",
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
