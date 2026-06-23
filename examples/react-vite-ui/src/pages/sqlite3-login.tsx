import "@vexnor/sqlite3";
import { Suspense, use, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { selectAccountsForLogin } from "#shared/queries/sqlite3";
import { remoteClient } from "#/remote-client.js";
import { useAuth } from "#/auth-context.js";
import type { IAccountSelect } from "#shared/codegen/sqlite3/main.account-table.js";
import type { IOrderSelect } from "#shared/codegen/sqlite3/main.order-table.js";

type LoginAccount = IAccountSelect & {
   orders: (IOrderSelect & { productCount: number })[];
};

// Minimal JWT builder — encodes accountId as `sub`, no real signing (demo only)
function makeFakeToken(accountId: string, name: string): string {
   const header = btoa(JSON.stringify({ alg: "none" })).replace(/=/g, "");
   const payload = btoa(JSON.stringify({ sub: accountId, name, roles: ["user"] })).replace(/=/g, "");
   return `${header}.${payload}.signature`;
}

function AccountPickerTable({
   promise,
   onPick,
}: {
   promise: Promise<LoginAccount[]>;
   onPick: (account: LoginAccount) => void;
}) {
   const accounts = use(promise);
   const [picking, setPicking] = useState<string | null>(null);

   function handlePick(account: LoginAccount) {
      setPicking(account.accountId);
      onPick(account);
   }

   return (
      <div className="table-wrap">
         <table>
            <thead>
               <tr>
                  <th>Email</th>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Orders</th>
                  <th></th>
               </tr>
            </thead>
            <tbody>
               {accounts.length === 0 ? (
                  <tr className="empty-row">
                     <td colSpan={5}>No accounts found.</td>
                  </tr>
               ) : (
                  accounts.map((account) => (
                     <tr key={account.accountId}>
                        <td>{account.email}</td>
                        <td>{account.firstName}</td>
                        <td>{account.lastName}</td>
                        <td>{account.orders.length}</td>
                        <td>
                           <button
                              className="btn btn-primary"
                              disabled={picking === account.accountId}
                              onClick={() => handlePick(account)}
                           >
                              {picking === account.accountId ? "Signing in…" : "Sign in as"}
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

export default function Sqlite3LoginPage() {
   const { login } = useAuth("sqlite3");
   const navigate = useNavigate();
   const [promise, setPromise] = useState<Promise<LoginAccount[]>>(Promise.resolve([]));

   useEffect(() => {
      setPromise(selectAccountsForLogin.all({ db: remoteClient }) as Promise<LoginAccount[]>);
   }, []);

   function handlePick(account: LoginAccount) {
      login(makeFakeToken(account.accountId, `${account.firstName} ${account.lastName}`));
      void navigate({ to: "/sqlite3", search: { filter: undefined } });
   }

   return (
      <div className="page">
         <h1>Sign in — SQLite3</h1>
         <p className="login-hint">
            Pick an account to sign in as. This is a demo — the selected <code>account_id</code> becomes the runtime{" "}
            <code>userId</code> injected server-side into queries that use <code>runtime("userId")</code>.
         </p>
         <Suspense fallback={<p className="loading">Loading accounts…</p>}>
            <AccountPickerTable promise={promise} onPick={handlePick} />
         </Suspense>
      </div>
   );
}
