import { beforeAll, describe, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { insert, row, sql as coreSql } from "@vexnor/core";
import "@vexnor/sqlite3";
import { sql } from "@vexnor/sqlite3";
import { Account, IAccountInsert, IAccountSelect } from "./codegen/main.account-table.js";
import { Order, IOrderInsert, IOrderSelect } from "./codegen/main.order-table.js";
import { OrderItem, IOrderItemInsert } from "./codegen/main.order_item-table.js";
import { Product, IProductInsert, IProductSelect } from "./codegen/main.product-table.js";
import { db } from "./config.js";

describe.sequential("joinBy — e2e sqlite3", () => {
   let account!: IAccountSelect;
   let order!: IOrderSelect;
   let product!: IProductSelect;

   beforeAll(async () => {
      const accountInsert: IAccountInsert = {
         accountId: randomUUID(),
         email: `joinby-${randomUUID()}@test.com`,
         firstName: "JoinBy",
         lastName: "Test",
      };
      account = await sql`
         insert into ${Account} ${insert(Account, "rows")} returning ${row(Account.$$)}
      `.sqlite.one({ db, params: { rows: [accountInsert] } });

      const productInsert: IProductInsert = {
         productId: randomUUID(),
         name: `Product-${randomUUID().slice(0, 8)}`,
         price: 29.99,
      };
      product = await sql`
         insert into ${Product} ${insert(Product, "rows")} returning ${row(Product.$$)}
      `.sqlite.one({ db, params: { rows: [productInsert] } });

      const orderInsert: IOrderInsert = {
         orderId: randomUUID(),
         accountId: account.accountId,
         createdAt: new Date().toISOString(),
         modifiedAt: new Date().toISOString(),
      };
      order = await sql`
         insert into ${Order} ${insert(Order, "rows")} returning ${row(Order.$$)}
      `.sqlite.one({ db, params: { rows: [orderInsert] } });

      const itemInsert: IOrderItemInsert = {
         orderId: order.orderId!,
         productId: product.productId!,
         quantity: 3,
         productPrice: 29.99,
      };
      await sql`
         insert into ${OrderItem} ${insert(OrderItem, "rows")} returning ${row(OrderItem.$$)}
      `.sqlite.one({ db, params: { rows: [itemInsert] } });
   });

   test("single join: Order → Account", async () => {
      const query = Order.join({ account: Account }).select({});
      const result = await query.sqlite.all({
         db,
         params: {
            joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } },
            filterBy: [{ orderId: order.orderId }],
         },
      });
      expect(result.length).toBe(1);
      expect(result[0]!.orderId).toBe(order.orderId);
   });

   test("chained join: OrderItem → Order → Account", async () => {
      const query = OrderItem.join({ order: Order, account: Account }).select({});
      const result = await query.sqlite.all({
         db,
         params: {
            joinBy: {
               order: { on: [["_.orderId", "=", "order.orderId"]] },
               account: { on: [["order.accountId", "=", "account.accountId"]] },
            },
            filterBy: [{ "account.accountId": account.accountId }],
         },
      });
      expect(result.length).toBe(1);
      expect(result[0]!.quantity).toBe(3);
   });

   test("left join returns rows even when no match", async () => {
      const lonelyOrder: IOrderInsert = {
         orderId: randomUUID(),
         accountId: account.accountId,
         createdAt: new Date().toISOString(),
         modifiedAt: new Date().toISOString(),
      };
      await sql`
         insert into ${Order} ${insert(Order, "rows")} returning ${row(Order.$$)}
      `.sqlite.one({ db, params: { rows: [lonelyOrder] } });

      const query = Order.join({ account: Account }).select({});
      const result = await query.sqlite.all({
         db,
         params: {
            joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]], type: "left" } },
            filterBy: [{ accountId: account.accountId }],
            orderBy: { createdAt: "DESC" },
         },
      });
      expect(result.length).toBeGreaterThanOrEqual(2);
   });

   test("orderBy on joined table column", async () => {
      const query = Order.join({ account: Account }).select({});
      const result = await query.sqlite.all({
         db,
         params: {
            joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } },
            orderBy: { "account.email": "ASC" },
            limit: 5,
         },
      });
      expect(result.length).toBeGreaterThan(0);
   });
});

describe.sequential("JOIN: sql`` — e2e sqlite3 (raw JOIN arg via CRUD handler)", () => {
   let account!: IAccountSelect;
   let order!: IOrderSelect;

   beforeAll(async () => {
      const accountInsert: IAccountInsert = {
         accountId: randomUUID(),
         email: `join-raw-${randomUUID()}@test.com`,
         firstName: "JoinRaw",
         lastName: "Test",
      };
      account = await sql`
         insert into ${Account} ${insert(Account, "rows")} returning ${row(Account.$$)}
      `.sqlite.one({ db, params: { rows: [accountInsert] } });

      const orderInsert: IOrderInsert = {
         orderId: randomUUID(),
         accountId: account.accountId,
         createdAt: new Date().toISOString(),
         modifiedAt: new Date().toISOString(),
      };
      order = await sql`
         insert into ${Order} ${insert(Order, "rows")} returning ${row(Order.$$)}
      `.sqlite.one({ db, params: { rows: [orderInsert] } });
   });

   test("select with raw JOIN via sql template + sqlite execution", async () => {
      const result = await coreSql`
         select ${row(Order.$$)}
         from ${Order}
         join ${Account} on ${Account.$accountId} = ${Order.$accountId}
         where ${Order.$orderId} = ${order.orderId}
      `.sqlite.all({ db });
      expect(result.length).toBe(1);
      expect(result[0]!.orderId).toBe(order.orderId);
   });
});
