import "vexnor-postgres";
import { row, sql, param, col } from "vexnor";
import { jsonOne } from "vexnor-postgres";
import { Account } from "../codegen/postgres/vexnor_dev.account-table.js";
import { Order } from "../codegen/postgres/vexnor_dev.order-table.js";
import { OrderItem } from "../codegen/postgres/vexnor_dev.order_item-table.js";

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

const filter = param<{ filter?: string }>("filter");
const accountId = param<{ accountId: string }>("accountId");

export const selectAccounts = sql`
   select ${row(Account.$$)},
          (select count(*)
           from ${Order}
           where ${Order.$accountId} = ${Account.$accountId}) as ${col<{ orderCount: number }>("orderCount")},
          ${jsonOne(lastOrder).as("lastOrder")}
   from ${Account} ${jsonOne(lastOrder)}
   where (${filter}::text is null
      or ${Account.$email} ilike '%' || ${filter} || '%'
      or ${Account.$firstName} ilike '%' || ${filter} || '%'
      or ${Account.$lastName} ilike '%' || ${filter} || '%')
   order by ${Account.$createdAt} desc
`;

export const deleteAccount = Account.postgres.delete({
   WHERE: sql`${Account.$accountId} = ${accountId}`,
});

export const insertAccount = Account.postgres.insertRows();
