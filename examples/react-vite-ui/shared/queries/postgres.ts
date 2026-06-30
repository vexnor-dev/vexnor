// noinspection SqlNoDataSourceInspection,SqlResolve
import "@vexnor/postgres";
import { row, sql, param, col, ctx } from "@vexnor/core";
import { Account } from "../codegen/postgres/vexnor_dev.account-table.js";
import { Order } from "../codegen/postgres/vexnor_dev.order-table.js";
import { OrderItem } from "../codegen/postgres/vexnor_dev.order_item-table.js";

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

export const selectAccounts = Account.postgres.select({
   SELECT: sql`${row(Account.$$)}, (select count(*) from ${Order} where ${Order.$accountId} = ${Account.$accountId}) as ${col<{ orderCount: number }>("orderCount")}`,
   WHERE: sql`
      ${filter}::text is null
      or ${Account.$email} ilike '%' || ${filter} || '%'
      or ${Account.$firstName} ilike '%' || ${filter} || '%'
      or ${Account.$lastName} ilike '%' || ${filter} || '%'
   `,
   ORDER_BY: sql`${Account.$createdAt} desc`,
   includeOne: { lastOrder: accountOrders },
});

/**
 * Login picker query — returns all accounts with their order and product counts.
 * Used to populate the login screen so a user can pick an account to sign in as.
 */
export const selectAccountsForLogin = Account.postgres.select({
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
export const selectMyOrders = Order.postgres.select({
   WHERE: sql`${Order.$accountId} = ${ctx<{ userId: string }>("userId")}`,
   ORDER_BY: sql`${Order.$createdAt} desc`,
   includeMany: { items: orderItems },
});

export const deleteAccount = Account.postgres.delete({
   WHERE: sql`${Account.$accountId} = ${accountId}`,
});

export const insertAccount = Account.postgres.insertRows();
