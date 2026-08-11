import { beforeAll, describe, expect, test } from "vitest";
import { param, row } from "@vexnor/core";
import { sql } from "@vexnor/duckdb";
import { OrderItem, type IOrderItemSelect } from "./codegen/main.order_item-table.js";
import { Product } from "./codegen/main.product-table.js";
import { db } from "./config.js";
import { insertAccount, insertOrder, insertProduct } from "./fixtures.js";

describe.sequential("DuckDB product and order-item e2e", () => {
   let orderItem: IOrderItemSelect;

   beforeAll(async () => {
      const account = await insertAccount("order-flow");
      const order = await insertOrder(account.accountId);
      const product = await insertProduct("order-flow");
      orderItem = await OrderItem.duckdb.insertRows().one({
         db,
         params: { rows: [{
            orderId: order.orderId,
            productId: product.productId,
            productPrice: "19.95",
            discountPrice: "17.50",
            quantity: 2,
            metadata: JSON.stringify({ warehouse: "BER", fragile: false }),
         }] },
      });
   });

   test("round-trips the comparable product JSON/list and order-item schema", async () => {
      const result = await sql`
         select ${row(
            OrderItem.$$,
            Product.as("product").$metadata.as("productMetadata"),
            Product.as("product").$tags.as("productTags"),
         )}
         from ${OrderItem}
         join ${Product.as("product")} on ${Product.as("product").$productId} = ${OrderItem.$productId}
         where ${OrderItem.$orderId} = ${orderItem.orderId} and ${OrderItem.$productId} = ${orderItem.productId}
      `.duckdb.one({ db });
      const { orderId, productId, createdAt, modifiedAt, ...stable } = result;

      expect(orderId).toBe(orderItem.orderId);
      expect(productId).toBe(orderItem.productId);
      expect(createdAt).toBeInstanceOf(Date);
      expect(modifiedAt).toBeInstanceOf(Date);
      expect(stable).toMatchInlineSnapshot(`
        {
          "discountPrice": 17.5,
          "metadata": "{"warehouse":"BER","fragile":false}",
          "productMetadata": "{"brand":"Vexnor","dimensions":{"width":1,"height":2}}",
          "productPrice": 19.95,
          "productTags": [
            "duckdb",
            "e2e",
          ],
          "quantity": 2,
        }
      `);
   });

   test("updates a composite-key order item through generated CRUD", async () => {
      const updated = await OrderItem.duckdb.update({
         WHERE: sql`${OrderItem.$orderId} = ${param<{ orderId: string }>("orderId")}
            and ${OrderItem.$productId} = ${param<{ productId: string }>("productId")}`,
      }).one({
         db,
         params: {
            orderId: orderItem.orderId,
            productId: orderItem.productId,
            set: { quantity: 3, discountPrice: null },
         },
      });

      expect({ quantity: updated.quantity, discountPrice: updated.discountPrice }).toMatchInlineSnapshot(`
        {
          "discountPrice": null,
          "quantity": 3,
        }
      `);
      orderItem = updated;
   });

   test("deletes a composite-key order item through generated CRUD", async () => {
      const deleted = await OrderItem.duckdb.delete({
         WHERE: sql`${OrderItem.$orderId} = ${orderItem.orderId} and ${OrderItem.$productId} = ${orderItem.productId}`,
      }).one({ db });

      expect(deleted.orderId).toBe(orderItem.orderId);
      expect(deleted.productId).toBe(orderItem.productId);
   });
});
