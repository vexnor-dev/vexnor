import { IAccountSelect } from "../codegen/one_sql.account-table.js";
import { IOrderJson } from "../codegen/one_sql.order-table.js";

export type AccountWithOrders = IAccountSelect & {
   orders: Pick<IOrderJson, "orderId" | "createdAt" | "status" | "accountId">[];
};
