import { When } from "@cucumber/cucumber";
import { TestWorld } from "../../test-world.js";
import { deepStrictEqual, ok } from "node:assert";
import { db } from "../../db/sqlite.js";
import { IOrderInsert, IOrderSelect, Order } from "../../codegen/sqlite/main.order-table.js";
import { sql } from "valnor";

When(/^Inserting (\d+) new Orders using SQLite$/, async function (this: TestWorld, countOfOrders: number) {
   ok(this.accountInserted, "account is required");

   const accountId = this.accountInserted.accountId;
   if (!accountId) throw new Error("Account ID is required");
   const newOrdersValues: IOrderInsert[] = [];
   for (let i = 0; i < countOfOrders; i++) {
      newOrdersValues.push({
         accountId,
         status: "created",
         createdAt: new Date().toISOString(),
         modifiedAt: new Date().toISOString(),
      });
   }

   const newOrders = sql<IOrderSelect>`
      INSERT INTO ${Order}
         ${Order.$$values(...newOrdersValues)}
         RETURNING ${Order.$$all}
   `.sqlite3.getAll(db);
   ok(newOrders?.length, "new orders are required");
   deepStrictEqual(newOrders.length, 2);
   for (const order of newOrders) {
      deepStrictEqual(order.status, "created");
      deepStrictEqual(order.accountId, accountId);
   }

   this.ordersInserted = newOrders;
});
