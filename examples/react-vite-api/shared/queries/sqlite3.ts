// noinspection SqlNoDataSourceInspection,SqlResolve
import "@vexnor/sqlite3";
import { col, param, row, ctx, sql } from "vexnor";
import { Account } from "../codegen/sqlite3/main.account-table.js";
import { Order } from "../codegen/sqlite3/main.order-table.js";
import { OrderItem } from "../codegen/sqlite3/main.order_item-table.js";

const filter = param<{ filter?: string }>("filter");
const accountId = param<{ accountId: string }>("accountId");

const orderItems = sql`
   select ${row(OrderItem.$$)}
   from ${OrderItem}
   where ${OrderItem.$orderId} = ${Order.out.$orderId}
`;

const accountOrders = sql`
   select ${row(Order.$$)},
          (select count(*) from ${OrderItem} where ${OrderItem.$orderId} = ${Order.$orderId}) as ${col<{ productCount: number }>("productCount")}
   from ${Order}
   where ${Order.$accountId} = ${Account.out.$accountId}
   order by ${Order.$createdAt} desc
`;

const lastOrder = sql`
   select ${row(Order.$orderId, Order.$status, Order.$createdAt)},
          (select count(*)
           from ${OrderItem}
           where ${OrderItem.$orderId} = ${Order.$orderId}) as ${col<{ productCount: number }>("productCount")}
   from ${Order}
   where ${Order.$accountId} = ${Account.out.$accountId}
   order by ${Order.$createdAt} desc
   limit 1
`;

export const selectAccounts = Account.sqlite.select({
   SELECT: sql`${row(Account.$$)}, (select count(*) from ${Order} where ${Order.$accountId} = ${Account.$accountId}) as ${col<{ orderCount: number }>("orderCount")}`,
   WHERE: sql`
      ${filter} is null
      or ${Account.$email} like '%' || ${filter} || '%'
      or ${Account.$firstName} like '%' || ${filter} || '%'
      or ${Account.$lastName} like '%' || ${filter} || '%'
   `,
   ORDER_BY: sql`${Account.$createdAt} desc`,
   includeOne: { lastOrder },
});

/**
 * Login picker query — returns all accounts with their orders eagerly loaded.
 * Used to populate the login screen so a user can pick an account to sign in as.
 */
export const selectAccountsForLogin = Account.sqlite.select({
   WHERE: sql`
      (select count(*) from ${Order} where ${Order.$accountId} = ${Account.$accountId}) > 0
   `,
   ORDER_BY: sql`${Account.$createdAt} desc`,
   includeMany: { orders: accountOrders },
});

/**
 * My orders query — returns orders with their items for the authenticated user.
 * Uses runtime("userId") so the value is injected from the server-side session,
 * never supplied by the client.
 */
export const selectMyOrders = Order.sqlite.select({
   WHERE: sql`${Order.$accountId} = ${ctx<{ userId: string }>("userId")}`,
   ORDER_BY: sql`${Order.$createdAt} desc`,
   includeMany: { items: orderItems },
});

export const deleteAccount = Account.sqlite.delete({
   WHERE: sql`${Account.$accountId} = ${accountId}`,
});

export const insertAccount = Account.sqlite.insertRows();
