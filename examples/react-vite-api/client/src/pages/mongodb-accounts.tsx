import { Suspense, useEffect, useState } from "react";
import { findAccounts, deleteAccount, insertAccount } from "#shared/queries/mongodb";
import { SearchInput } from "#src/components/search-input.js";
import { useRemoteClient } from "#src/use-remote-client.js";

type MongoAccount = {
   _id: string;
   status: string;
   email: string;
   name: { first: string; last: string };
   notes: string | null;
   createdAt: string;
   modifiedAt: string;
};

export default function MongoDBAccountsPage() {
   const remoteClient = useRemoteClient("mongodb");
   const [accounts, setAccounts] = useState<MongoAccount[]>([]);
   const [status, setStatus] = useState("confirmed");
   const [loading, setLoading] = useState(true);

   async function fetchAccounts(statusFilter: string) {
      setLoading(true);
      try {
         const result = await findAccounts.all({
            db: remoteClient,
            params: { status: statusFilter, limit: 50 },
         });
         setAccounts(result as MongoAccount[]);
      } finally {
         setLoading(false);
      }
   }

   useEffect(() => {
      void fetchAccounts(status);
   }, [status]);

   async function handleCreate(email: string, firstName: string, lastName: string) {
      await insertAccount.all({
         db: remoteClient,
         params: {
            doc: {
               _id: crypto.randomUUID(),
               status: "created",
               email,
               name: { first: firstName, last: lastName },
               notes: null,
               createdAt: new Date(),
               modifiedAt: new Date(),
            },
         },
      });
      void fetchAccounts(status);
   }

   async function handleDelete(id: string) {
      await deleteAccount.all({ db: remoteClient, params: { id } });
      void fetchAccounts(status);
   }

   return (
      <div className="page">
         <h1>MongoDB</h1>
         <div className="toolbar">
            <label>
               Status:{" "}
               <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="confirmed">Confirmed</option>
                  <option value="created">Created</option>
                  <option value="deleted">Deleted</option>
               </select>
            </label>
         </div>
         <div className={loading ? "loading" : ""}>
            <table className="account-table">
               <thead>
                  <tr>
                     <th>Name</th>
                     <th>Email</th>
                     <th>Status</th>
                     <th>Notes</th>
                     <th>Created</th>
                     <th></th>
                  </tr>
               </thead>
               <tbody>
                  {accounts.map((a) => (
                     <tr key={a._id}>
                        <td>{a.name.first} {a.name.last}</td>
                        <td>{a.email}</td>
                        <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                        <td>{a.notes ?? "—"}</td>
                        <td>{new Date(a.createdAt).toLocaleDateString()}</td>
                        <td>
                           <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a._id)}>
                              Delete
                           </button>
                        </td>
                     </tr>
                  ))}
                  {!loading && accounts.length === 0 && (
                     <tr>
                        <td colSpan={6} className="empty">No accounts found</td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>
   );
}
