"use client";

import { startTransition, Suspense, useState } from "react";
import { DeleteButton } from "./delete-button";
import { AlertMessage } from "./alert-message";
import { TypeOf } from "@vexnor/core";
import * as postgres from "@/shared/queries/postgres";
import * as mssql from "@/shared/queries/mssql";
import * as sqlite3 from "@/shared/queries/sqlite3";
import { useRouter } from "next/navigation";

export type AccountRow =
   | TypeOf<typeof postgres.selectAccounts>
   | TypeOf<typeof mssql.selectAccounts>
   | TypeOf<typeof sqlite3.selectAccounts>;

export function AccountTable({
   accounts,
   deleteAction,
}: {
   accounts: AccountRow[];
   deleteAction: (accountId: string) => Promise<{ deleted: boolean; refresh?: boolean }>;
}) {
   const [alert, setAlert] = useState<string | null>(null);
   const router = useRouter();

   async function handleDelete(accountId: string, email: string) {
      const { deleted, refresh } = await deleteAction(accountId);
      if (deleted) {
         setAlert(`Account ${email} deleted.`);
      }

      if (refresh) {
         startTransition(() => router.refresh());
      }
   }

   return (
      <>
         <AlertMessage message={alert} onDismiss={() => setAlert(null)} />
         <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm text-left">
               <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wide">
                  <tr>
                     <th className="px-4 py-3 font-medium">Email</th>
                     <th className="px-4 py-3 font-medium">First Name</th>
                     <th className="px-4 py-3 font-medium">Last Name</th>
                     <th className="px-4 py-3 font-medium">Status</th>
                     <th className="px-4 py-3 font-medium">Created At</th>
                     <th className="px-4 py-3 font-medium">Orders</th>
                     <th className="px-4 py-3 font-medium">Last Order</th>
                     <th className="px-4 py-3" />
                  </tr>
               </thead>
               <Suspense
                  fallback={
                     <tbody>
                        <tr>
                           <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                              Loading accounts...
                           </td>
                        </tr>
                     </tbody>
                  }
               >
                  <AccountTableBody accounts={accounts} deleteAction={handleDelete} />
               </Suspense>
            </table>
         </div>
      </>
   );
}

function AccountTableBody({
   accounts,
   deleteAction,
}: {
   accounts: AccountRow[];
   deleteAction: (accountId: string, email: string) => Promise<void>;
}) {
   return (
      <tbody className="divide-y divide-gray-100">
         {accounts.length === 0 ? (
            <tr>
               <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No accounts yet.
               </td>
            </tr>
         ) : (
            accounts.map((account) => (
               <tr key={account.accountId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-900">{account.email}</td>
                  <td className="px-4 py-3 text-gray-700">{account.firstName}</td>
                  <td className="px-4 py-3 text-gray-700">{account.lastName}</td>
                  <td className="px-4 py-3">
                     <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        {account.status}
                     </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(account.createdAt).toLocaleDateString("en-CA")}</td>
                  <td className="px-4 py-3 text-gray-700">{account.orderCount}</td>
                  <td className="px-4 py-3 text-gray-500">
                     {account.lastOrder ? (
                        <div className="flex flex-col gap-0.5">
                           <span>{account.lastOrder.status}</span>
                           <span className="text-gray-400 text-xs">
                              {new Date(account.lastOrder.createdAt).toLocaleDateString("en-CA")}
                           </span>
                           <span className="text-gray-400 text-xs">{account.lastOrder.productCount} products</span>
                        </div>
                     ) : (
                        "—"
                     )}
                  </td>
                  <td className="px-4 py-3">
                     <DeleteButton
                        accountId={account.accountId}
                        orderCount={account.orderCount}
                        deleteAction={(id) => deleteAction(id, account.email)}
                     />
                  </td>
               </tr>
            ))
         )}
      </tbody>
   );
}
