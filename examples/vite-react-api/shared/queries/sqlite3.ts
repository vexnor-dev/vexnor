import "vexnor-sqlite3";
import { row, sql, param, col } from "vexnor";
import { jsonOne } from "vexnor-sqlite3";
import { Account } from "../codegen/sqlite3/main.account-table.js";
import { Order } from "../codegen/sqlite3/main.order-table.js";
import { OrderItem } from "../codegen/sqlite3/main.order_item-table.js";

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

export const selectAccounts = sql`
   select ${row(Account.$$)},
          (select count(*)
           from ${Order}
           where ${Order.$accountId} = ${Account.$accountId}) as ${col<{ orderCount: number }>("orderCount")},
          ${jsonOne(lastOrder).as("lastOrder")}
   from ${Account}
   order by ${Account.$createdAt} desc
`;

export const deleteAccount = Account.sqlite.delete({
   WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`,
});

export const insertAccount = Account.sqlite.insertRows();
