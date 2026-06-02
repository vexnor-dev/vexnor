import "vexnor-postgres";
import { col, expand, param, ParamsOf, raw, row, sql } from "vexnor";
import { jsonOne } from "vexnor-postgres";
import { Account, IAccountSelect } from "@/shared/codegen/postgres/vexnor_dev.account-table";
import { Order } from "@/shared/codegen/postgres/vexnor_dev.order-table";
import { OrderItem } from "@/shared/codegen/postgres/vexnor_dev.order_item-table";
import { OrderDirection } from "@/shared/queries/params";

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
export const accountOrderBy = param<{ accountOrderBy: AccountOrderBy | string }>("accountOrderBy", {
   default: "created_at",
   values: Object.values(Account.cols).map((c) => c.columnName),
});
export const orderDir = param<{ orderDir: OrderDirection }>("orderDir", { default: "DESC", values: ["ASC", "DESC"] });

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
   ${expand<{ accountOrderBy: AccountOrderBy | string; orderDir: OrderDirection }>(
      { accountOrderBy: accountOrderBy.validation, orderDir: orderDir.validation },
      ({ accountOrderBy, orderDir }) => {
         return sql`order by ${raw(String(accountOrderBy))} ${raw(orderDir)}`;
      },
   )}`;

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
   return Object.assign(
      {
         filter: args.searchParams?.get(filter.name) ?? undefined,
         accountOrderBy: args.searchParams?.get(accountOrderBy.name) ?? undefined,
         orderDir: args.searchParams?.get(orderDir.name) ?? undefined,
      },
      args.values,
   ) as SelectAccountsParams;
}
