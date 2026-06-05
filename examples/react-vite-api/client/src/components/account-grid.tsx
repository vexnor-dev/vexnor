import { use, useTransition } from "react";
import * as mssql from "#shared/queries/mssql";
import * as postgres from "#shared/queries/postgres";
import * as sqlite3 from "#shared/queries/sqlite3";

export type AccountRow =
   | typeof postgres.selectAccounts.rowType
   | typeof mssql.selectAccounts.rowType
   | typeof sqlite3.selectAccounts.rowType;

export function AccountGrid({
   promise,
   onRefresh,
   onDelete,
}: {
   promise: Promise<AccountRow[]>;
   onRefresh: () => void;
   onDelete: (accountId: string) => Promise<unknown>;
}) {
   const accounts = use(promise);
   const [pending, startTransition] = useTransition();

   return (
      <div className="table-wrap">
         <table style={{ opacity: pending ? 0.5 : 1 }}>
            <thead>
               <tr>
                  <th>Email</th>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th>Orders</th>
                  <th>Last Order</th>
                  <th></th>
               </tr>
            </thead>
            <tbody>
               {accounts.length === 0 ? (
                  <tr className="empty-row">
                     <td colSpan={8}>No accounts yet.</td>
                  </tr>
               ) : (
                  accounts.map((account) => (
                     <tr key={account.accountId}>
                        <td>{account.email}</td>
                        <td>{account.firstName}</td>
                        <td>{account.lastName}</td>
                        <td>
                           <span className="badge">{account.status}</span>
                        </td>
                        <td>{new Date(account.createdAt).toLocaleDateString("en-CA")}</td>
                        <td>{String(account.orderCount)}</td>
                        <td>
                           {account.lastOrder ? (
                              <div className="last-order">
                                 <span className="last-order-status">{account.lastOrder.status}</span>
                                 <span className="last-order-meta">
                                    {new Date(account.lastOrder.createdAt).toLocaleDateString("en-CA")} ·{" "}
                                    {account.lastOrder.productCount} products
                                 </span>
                              </div>
                           ) : (
                              "—"
                           )}
                        </td>
                        <td>
                           <button
                              className="btn btn-danger"
                              disabled={Number(account.orderCount) > 0}
                              onClick={() => onDelete(account.accountId).then(() => startTransition(onRefresh))}
                           >
                              Delete
                           </button>
                        </td>
                     </tr>
                  ))
               )}
            </tbody>
         </table>
      </div>
   );
}
