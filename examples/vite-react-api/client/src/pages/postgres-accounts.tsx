import "vexnor-postgres";
import { Suspense, use, useActionState, useState, useTransition } from "react";
import { useRemoteClient } from "#/use-remote-client.js";
import { deleteAccount, insertAccount, selectAccounts } from "#shared/queries/postgres";
import { TypeOf } from "vexnor";

function AccountGrid({
   promise,
   onRefresh,
}: {
   promise: Promise<TypeOf<typeof selectAccounts>[]>;
   onRefresh: () => void;
}) {
   const accounts = use(promise);
   const [pending, startTransition] = useTransition();
   const db = useRemoteClient();

   function onDelete(accountId: string) {
      deleteAccount.postgres.run({ db, params: { accountId } }).then(() => startTransition(onRefresh));
   }

   return (
      <table>
         <thead>
            <tr>
               <th>Email</th>
               <th>First Name</th>
               <th>Last Name</th>
               <th>Status</th>
               <th>Created At</th>
               <th>Orders #</th>
               <th>Last Order</th>
               <th></th>
            </tr>
         </thead>
         <tbody style={{ opacity: pending ? 0.5 : 1 }}>
            {accounts.map((account) => (
               <tr key={account.accountId}>
                  <td>{account.email}</td>
                  <td>{account.firstName}</td>
                  <td>{account.lastName}</td>
                  <td>{account.status}</td>
                  <td>{new Date(account.createdAt).toLocaleString()}</td>
                  <td>{account.orderCount}</td>
                  <td>{account.lastOrder ? `${account.lastOrder.status} — ${new Date(account.lastOrder.createdAt).toLocaleDateString()} (${account.lastOrder.productCount} products)` : "—"}</td>
                  <td>
                     <button onClick={() => onDelete(account.accountId)}>Delete</button>
                  </td>
               </tr>
            ))}
         </tbody>
      </table>
   );
}

function CreateAccountForm({ onCreated }: { onCreated: () => void }) {
   const db = useRemoteClient();
   const [error, submitAction, pending] = useActionState(async (_: unknown, formData: FormData) => {
      const email = formData.get("email") as string;
      const firstName = formData.get("firstName") as string;
      const lastName = formData.get("lastName") as string;
      await insertAccount.run({ db, params: { rows: [{ email, firstName, lastName }] } });
      onCreated();
      return null;
   }, null);

   return (
      <form action={submitAction}>
         <input name="email" placeholder="Email" required />
         <input name="firstName" placeholder="First name" required />
         <input name="lastName" placeholder="Last name" required />
         <button type="submit" disabled={pending}>
            {pending ? "Creating..." : "Create"}
         </button>
         {error && <p>{String(error)}</p>}
      </form>
   );
}

export default function PostgresAccountsPage() {
   const db = useRemoteClient();
   const [promise, setPromise] = useState(() => selectAccounts.postgres.all({ db }));

   function refresh() {
      setPromise(selectAccounts.postgres.all({ db }));
   }

   return (
      <>
         <h1>Accounts (PostgreSQL)</h1>
         <CreateAccountForm onCreated={refresh} />
         <Suspense fallback={<p>Loading...</p>}>
            <AccountGrid promise={promise} onRefresh={refresh} />
         </Suspense>
      </>
   );
}
