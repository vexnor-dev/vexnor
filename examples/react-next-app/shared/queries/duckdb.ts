// noinspection SqlNoDataSourceInspection,SqlResolve
import "@vexnor/duckdb";
import { col, param, row } from "@vexnor/core";
import { jsonOne, sql } from "@vexnor/duckdb";
import { Account } from "../codegen/duckdb/main.account-table";
import { Order } from "../codegen/duckdb/main.order-table";
import { OrderItem } from "../codegen/duckdb/main.order_item-table";

const lastOrder = sql`
   select ${row(Order.$orderId, Order.$status, Order.$createdAt)},
          (select cast(count(*) as integer)
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
          (select cast(count(*) as integer)
           from ${Order}
           where ${Order.$accountId} = ${Account.$accountId}) as ${col<{ orderCount: number }>("orderCount")},
          ${jsonOne(lastOrder).as("lastOrder")}
   from ${Account}
   where (${filter} is null
      or ${Account.$email} ilike '%' || ${filter} || '%'
      or ${Account.$firstName} ilike '%' || ${filter} || '%'
      or ${Account.$lastName} ilike '%' || ${filter} || '%')
   order by ${Account.$createdAt} desc
`;

export const deleteAccount = Account.duckdb.delete({
   WHERE: sql`${Account.$accountId} = ${accountId}`,
});

export const insertAccount = Account.duckdb.insertRows();
