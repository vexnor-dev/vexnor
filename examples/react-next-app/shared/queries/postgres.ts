// noinspection SqlNoDataSourceInspection,SqlResolve
import "@vexnor/postgres";
import { col, orderBy, param, ParamsOf, raw, row, sql } from "@vexnor/core";
import { jsonOne } from "@vexnor/postgres";
import { Account, IAccountSelect } from "@/shared/codegen/postgres/vexnor_dev.account-table";
import { Order } from "@/shared/codegen/postgres/vexnor_dev.order-table";
import { OrderItem } from "@/shared/codegen/postgres/vexnor_dev.order_item-table";

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

export type AccountOrderBy = keyof IAccountSelect;

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
   ${orderBy(Account)}`;

export type SelectAccountsParams = ParamsOf<typeof selectAccounts>;

export const deleteAccount = Account.postgres.delete({
   WHERE: sql`${Account.$accountId} = ${accountId}`,
});

export const insertAccount = Account.postgres.insertRows();

export const queries = { selectAccounts, deleteAccount, insertAccount };

export function getSelectAccountParams(args: {
   searchParams?: URLSearchParams;
   values?: Partial<SelectAccountsParams>;
}): SelectAccountsParams {
   const col = args.searchParams?.get("accountOrderBy") ?? "createdAt";
   const dir = args.searchParams?.get("orderDir") ?? "DESC";
   return Object.assign(
      {
         filter: args.searchParams?.get("filter") ?? undefined,
         orderBy: { [col]: dir },
      },
      args.values,
   ) as SelectAccountsParams;
}
