import "@vexnor/sqlite3";
import { Suspense, useEffect, useState } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { contextValue } from "vexnor";
import { deleteAccount, insertAccount, selectAccounts, selectMyOrders } from "#shared/queries/sqlite3";
import { AccountGrid } from "#/components/account-grid.js";
import { CreateAccountForm } from "#/components/create-account-form.js";
import { SearchInput } from "#/components/search-input.js";
import { MyOrders } from "#/components/my-orders.js";
import { useRemoteClient } from "#/use-remote-client.js";
import { useAuth } from "#/auth-context.js";

type Tab = "orders" | "accounts";

export default function Sqlite3AccountsPage() {
   const remoteClient = useRemoteClient("sqlite3");
   const auth = useAuth("sqlite3");
   const navigate = useNavigate();
   const { filter } = useSearch({ from: "/sqlite3" });
   const [tab, setTab] = useState<Tab>("orders");
   const [accountsPromise, setAccountsPromise] = useState<Promise<(typeof selectAccounts.rowType)[]>>(
      Promise.resolve([]),
   );
   const [ordersPromise] = useState<Promise<(typeof selectMyOrders.rowType)[]>>(() =>
      selectMyOrders.all({ db: remoteClient, params: { userId: contextValue } }),
   );

   useEffect(() => {
      if (tab === "accounts") {
         setAccountsPromise(selectAccounts.all({ db: remoteClient, params: { filter } }));
      }
   }, [tab, filter]);

   function refresh() {
      setAccountsPromise(selectAccounts.all({ db: remoteClient, params: { filter } }));
   }

   return (
      <div className="page">
         <h1>SQLite3</h1>
         <div className="tabs">
            <button className={`tab-btn${tab === "orders" ? " active" : ""}`} onClick={() => setTab("orders")}>
               My Orders
            </button>
            <button className={`tab-btn${tab === "accounts" ? " active" : ""}`} onClick={() => setTab("accounts")}>
               Accounts
            </button>
         </div>
         {tab === "orders" &&
            (auth.authenticated ? (
               <MyOrders promise={ordersPromise} />
            ) : (
               <div className="unauthenticated">
                  <p>Sign in to view your orders.</p>
                  <button className="btn btn-primary" onClick={() => void navigate({ to: "/sqlite3-login" })}>
                     Sign in
                  </button>
               </div>
            ))}
         {tab === "accounts" && (
            <>
               <CreateAccountForm
                  onCreated={(email, firstName, lastName) =>
                     insertAccount
                        .run({ db: remoteClient, params: { rows: [{ email, firstName, lastName }] } })
                        .then(refresh)
                  }
               />
               <SearchInput placeholder="Search by name or email…" />
               <Suspense fallback={<p className="loading">Loading…</p>}>
                  <AccountGrid
                     promise={accountsPromise}
                     onRefresh={refresh}
                     onDelete={(accountId) => deleteAccount.run({ db: remoteClient, params: { accountId } })}
                  />
               </Suspense>
            </>
         )}
      </div>
   );
}
