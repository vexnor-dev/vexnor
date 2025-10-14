import { When } from "@cucumber/cucumber";
import { TestWorld } from "../../test-world.js";
import { deepStrictEqual, ok } from "node:assert";
import { sql } from "valnor";
import { IOrderInsert, IOrderSelect, Order } from "../../codegen/mssql/one_sql.order-table.js";
import { getRequest } from "../../db/mssql.js";

When(/^Inserting (\d+) new Orders using MSSQL$/, async function (this: TestWorld, countOfOrders: number) {
  ok(this.mssql.accountInserted, "account is required");

  const accountId = this.mssql.accountInserted.accountId;
  if (!accountId) throw new Error("Account ID is required");
  const newOrdersValues: IOrderInsert[] = [];
  for (let i = 0; i < countOfOrders; i++) {
    newOrdersValues.push({
      accountId,
      status: "created",
      createdAt: new Date(),
      modifiedAt: new Date(),
    } as IOrderInsert);
  }

  // Perform insert (MSSQL does not support RETURNING in the same way)
  await sql<object>`
      insert into ${Order}
         ${Order.$$values(...newOrdersValues)}
    `.mssql.getAll({ db: await getRequest() });

  // Fetch the newly inserted orders
  const orders = await sql<IOrderSelect>`
      select ${Order.$$all}
      from ${Order}
      where ${Order.accountId} = ${accountId}
    `.mssql.getAll({ db: await getRequest() });

  ok(orders?.length, "new orders are required");
  deepStrictEqual(orders.length, countOfOrders);
  for (const order of orders) {
    deepStrictEqual(order.status, "created");
    deepStrictEqual(order.accountId, accountId);
  }

  this.mssql.ordersInserted = orders;
});
