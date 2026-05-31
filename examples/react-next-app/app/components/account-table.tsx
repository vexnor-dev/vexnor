"use client";

import type { AccountRow } from "./account-row";
import { DeleteButton } from "./delete-button";

export function AccountTable({
   accounts,
   deleteAction,
}: {
   accounts: AccountRow[];
   deleteAction: (accountId: string) => Promise<void>;
}) {
   return (
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
            <tbody className="divide-y divide-gray-100">
               {accounts.length === 0 ? (
                  <tr>
                     <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">No accounts yet.</td>
                  </tr>
               ) : accounts.map((account) => (
                  <tr key={account.accountId} className="hover:bg-gray-50 transition-colors">
                     <td className="px-4 py-3 text-gray-900">{account.email}</td>
                     <td className="px-4 py-3 text-gray-700">{account.firstName}</td>
                     <td className="px-4 py-3 text-gray-700">{account.lastName}</td>
                     <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{account.status}</span>
                     </td>
                     <td className="px-4 py-3 text-gray-500">{new Date(account.createdAt).toLocaleDateString("en-CA")}</td>
                     <td className="px-4 py-3 text-gray-700">{account.orderCount}</td>
                     <td className="px-4 py-3 text-gray-500">
                        {account.lastOrder ? (
                           <div className="flex flex-col gap-0.5">
                              <span>{account.lastOrder.status}</span>
                              <span className="text-gray-400 text-xs">{new Date(account.lastOrder.createdAt).toLocaleDateString("en-CA")}</span>
                              <span className="text-gray-400 text-xs">{account.lastOrder.productCount} products</span>
                           </div>
                        ) : "—"}
                     </td>
                     <td className="px-4 py-3">
                        <DeleteButton accountId={account.accountId} orderCount={account.orderCount} deleteAction={deleteAction} />
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
   );
}
