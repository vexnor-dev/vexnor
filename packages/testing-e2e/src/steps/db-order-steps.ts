import { When } from "@cucumber/cucumber";
import { TestWorld } from "../test-world.js";
import { deepStrictEqual, ok } from "node:assert";
import { pool } from "../db.js";
import { OrderStatusUdt } from "../codegen/one_sql-enums.js";
import { IOrderInsert, IOrderSelect, Order } from "../codegen/one_sql.order-table.js";
import { sql } from "valnor";

When(/^Inserting (\d+) new Orders$/, async function (this: TestWorld, countOfOrders: number) {
   ok(this.accountInserted, "account is required");

   const { accountId } = this.accountInserted;
   const newOrdersValues: IOrderInsert[] = [];
   for (let i = 0; i < countOfOrders; i++) {
      newOrdersValues.push({
         accountId,
         status: OrderStatusUdt.CREATED,
         createdAt: new Date(),
         modifiedAt: new Date(),
      });
   }

   const newOrders = await sql<IOrderSelect>`
      INSERT INTO ${Order}
         ${Order.$$values(...newOrdersValues)}
         RETURNING ${Order.$$all}
   `.pg.getAll(pool);
   ok(newOrders?.length, "new orders are required");
   deepStrictEqual(newOrders.length, 2);
   for (const order of newOrders) {
      deepStrictEqual(order.status, OrderStatusUdt.CREATED);
      deepStrictEqual(order.accountId, accountId);
   }

   this.ordersInserted = newOrders;
});
