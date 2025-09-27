import { When } from "@cucumber/cucumber";
import { TestWorld } from "../../test-world.js";
import { deepStrictEqual, ok } from "node:assert";
import { pool } from "../../db/postgres.js";
import { OrderStatusUdt } from "../../codegen/pg/one_sql-enums.js";
import { IOrderInsert, IOrderSelect, Order } from "../../codegen/pg/one_sql.order-table.js";
import { sql } from "valnor";

When(/^Inserting (\d+) new Orders using PostgreSQL$/, async function (this: TestWorld, countOfOrders: number) {
   ok(this.accountInserted, "account is required");

   const accountId = this.accountInserted.accountId;
   if (!accountId) throw new Error("Account ID is required");
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
   `.pg.getAll({ db: pool });
   ok(newOrders?.length, "new orders are required");
   deepStrictEqual(newOrders.length, 2);
   for (const order of newOrders) {
      deepStrictEqual(order.status, OrderStatusUdt.CREATED);
      deepStrictEqual(order.accountId, accountId);
   }

   this.ordersInserted = newOrders;
});