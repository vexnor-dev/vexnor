import { IAccountSelect } from "../codegen/postgres/one_sql.account-table.js";
import { IOrderJson } from "../codegen/postgres/one_sql.order-table.js";

export type AccountWithOrders = IAccountSelect & {
   orders: Pick<IOrderJson, "orderId" | "createdAt" | "status" | "accountId">[];
};
