"use client";

import { useState, useTransition } from "react";
import { findAccounts, deleteAccount } from "@/shared/queries/mongodb";
import { AlertMessage } from "./alert-message";
import { useRemoteClient } from "@/app/components/use-remote-client";

interface MongoAccount {
   _id: string;
   status: string;
   email: string;
   name: { first: string; last: string };
   notes: string | null;
   createdAt: Date;
   modifiedAt: Date;
}

export function MongoAccountsGrid({ initialAccounts }: { initialAccounts: MongoAccount[] }) {
   const remoteClient = useRemoteClient();
   const [isPending, startTransition] = useTransition();
   const [accounts, setAccounts] = useState<MongoAccount[]>(initialAccounts);
   const [alert, setAlert] = useState<string | null>(null);
   const [statusFilter, setStatusFilter] = useState("confirmed");

   function refetch(status: string) {
      startTransition(async () => {
         const result = await findAccounts.all({
            db: remoteClient,
            params: { status, limit: 50 },
         });
         setAccounts(result);
      });
   }

   function handleStatusChange(status: string) {
      setStatusFilter(status);
      refetch(status);
   }

   async function handleDelete(id: string) {
      const email = accounts.find((a) => a._id === id)?.email ?? id;
      await deleteAccount.all({ db: remoteClient, params: { id } });
      setAlert(`Account ${email} deleted.`);
      refetch(statusFilter);
   }

   return (
      <>
         <AlertMessage message={alert} onDismiss={() => setAlert(null)} />
         <div className="mb-4 flex gap-3 items-center">
            <label className="text-sm text-gray-600">Status:</label>
            <select
               value={statusFilter}
               onChange={(e) => handleStatusChange(e.target.value)}
               className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
            >
               <option value="confirmed">Confirmed</option>
               <option value="created">Created</option>
               <option value="deleted">Deleted</option>
            </select>
         </div>
         <div className={isPending ? "opacity-60 transition-opacity" : ""}>
            <table className="w-full text-sm border-collapse">
               <thead>
                  <tr className="border-b border-gray-200">
                     <th className="text-left py-2 px-3 text-gray-500 font-medium">Name</th>
                     <th className="text-left py-2 px-3 text-gray-500 font-medium">Email</th>
                     <th className="text-left py-2 px-3 text-gray-500 font-medium">Status</th>
                     <th className="text-left py-2 px-3 text-gray-500 font-medium">Notes</th>
                     <th className="text-left py-2 px-3 text-gray-500 font-medium">Created</th>
                     <th className="py-2 px-3"></th>
                  </tr>
               </thead>
               <tbody>
                  {accounts.map((account) => (
                     <tr key={account._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3">
                           {account.name.first} {account.name.last}
                        </td>
                        <td className="py-2 px-3 text-gray-600">{account.email}</td>
                        <td className="py-2 px-3">
                           <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                 account.status === "confirmed"
                                    ? "bg-green-100 text-green-700"
                                    : account.status === "created"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-red-100 text-red-700"
                              }`}
                           >
                              {account.status}
                           </span>
                        </td>
                        <td className="py-2 px-3 text-gray-500 text-xs">{account.notes ?? "—"}</td>
                        <td className="py-2 px-3 text-gray-400 text-xs">
                           {new Date(account.createdAt).toISOString().slice(0, 10)}
                        </td>
                        <td className="py-2 px-3 text-right">
                           <button
                              onClick={() => handleDelete(account._id)}
                              className="text-red-500 hover:text-red-700 text-xs"
                           >
                              Delete
                           </button>
                        </td>
                     </tr>
                  ))}
                  {accounts.length === 0 && (
                     <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-400">
                           No accounts found
                        </td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </>
   );
}
