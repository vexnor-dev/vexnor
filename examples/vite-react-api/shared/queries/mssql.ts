import "vexnor-mssql";
import { row, sql, param, col } from "vexnor";
import { jsonOne } from "vexnor-mssql";
import { Account } from "../codegen/mssql/vexnor_dev.account-table.js";
import { Order } from "../codegen/mssql/vexnor_dev.order-table.js";
import { OrderItem } from "../codegen/mssql/vexnor_dev.order_item-table.js";

const lastOrder = sql`
   select top 1 ${row(Order.$orderId, Order.$status, Order.$createdAt)},
          (select count(*)
           from ${OrderItem}
           where ${OrderItem.$orderId} = ${Order.$orderId}) as ${col<{ productCount: number }>("productCount")}
   from ${Order}
   where ${Order.$accountId} = ${Account.out.$accountId}
   order by ${Order.$createdAt} desc
`;

export const selectAccounts = sql`
   select ${row(Account.$$)},
          (select count(*)
           from ${Order}
           where ${Order.$accountId} = ${Account.$accountId}) as ${col<{ orderCount: number }>("orderCount")},
          ${jsonOne(lastOrder).as("lastOrder")}
   from ${Account} ${jsonOne(lastOrder)}
   order by ${Account.$createdAt} desc
`;

export const deleteAccount = Account.mssql.delete({
   WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`,
});

export const insertAccount = Account.mssql.insertRows();
