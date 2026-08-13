// noinspection SqlNoDataSourceInspection,SqlResolve
import "@vexnor/duckdb";
import { col, ctx, param, row } from "@vexnor/core";
import { sql } from "@vexnor/duckdb";
import { Account } from "../codegen/duckdb/main.account-table.js";
import { Order } from "../codegen/duckdb/main.order-table.js";
import { OrderItem } from "../codegen/duckdb/main.order_item-table.js";

const filter = param<{ filter?: string }>("filter");
const accountId = param<{ accountId: string }>("accountId");

const orderItems = sql`
   select ${row(OrderItem.$$)}
   from ${OrderItem}
   where ${OrderItem.$orderId} = ${Order.out.$orderId}
`;

const accountOrders = sql`
   select ${row(Order.$$)},
          (select cast(count(*) as integer) from ${OrderItem} where ${OrderItem.$orderId} = ${Order.$orderId}) as ${col<{ productCount: number }>("productCount")}
   from ${Order}
   where ${Order.$accountId} = ${Account.out.$accountId}
   order by ${Order.$createdAt} desc
`;

const lastOrder = sql`
   select ${row(Order.$orderId, Order.$status, Order.$createdAt)},
          (select cast(count(*) as integer) from ${OrderItem} where ${OrderItem.$orderId} = ${Order.$orderId}) as ${col<{ productCount: number }>("productCount")}
   from ${Order}
   where ${Order.$accountId} = ${Account.out.$accountId}
   order by ${Order.$createdAt} desc
   limit 1
`;

export const selectAccounts = Account.duckdb.select({
   SELECT: sql`${row(Account.$$)}, (select cast(count(*) as integer) from ${Order} where ${Order.$accountId} = ${Account.$accountId}) as ${col<{ orderCount: number }>("orderCount")}`,
   WHERE: sql`
      ${filter} is null
      or ${Account.$email} ilike '%' || ${filter} || '%'
      or ${Account.$firstName} ilike '%' || ${filter} || '%'
      or ${Account.$lastName} ilike '%' || ${filter} || '%'
   `,
   ORDER_BY: sql`${Account.$createdAt} desc`,
   includeOne: { lastOrder },
});

export const selectAccountsForLogin = Account.duckdb.select({
   WHERE: sql`(select cast(count(*) as integer) from ${Order} where ${Order.$accountId} = ${Account.$accountId}) > 0`,
   ORDER_BY: sql`${Account.$createdAt} desc`,
   includeMany: { orders: accountOrders },
});

export const selectMyOrders = Order.duckdb.select({
   WHERE: sql`${Order.$accountId} = ${ctx<{ userId: string }>("userId")}`,
   ORDER_BY: sql`${Order.$createdAt} desc`,
   includeMany: { items: orderItems },
});

export const deleteAccount = Account.duckdb.delete({
   WHERE: sql`${Account.$accountId} = ${accountId}`,
});

export const insertAccount = Account.duckdb.insertRows();
