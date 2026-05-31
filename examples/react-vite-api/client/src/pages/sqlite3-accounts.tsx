import "vexnor-sqlite3";
import { Suspense, useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { remoteClient } from "#/remote-client.js";
import { deleteAccount, insertAccount, selectAccounts } from "#shared/queries/sqlite3";
import { AccountGrid } from "#/components/account-grid.js";
import { CreateAccountForm } from "#/components/create-account-form.js";
import { SearchInput } from "#/components/search-input.js";
import type { AccountRow } from "#/components/account-row";

export default function Sqlite3AccountsPage() {
   const { filter } = useSearch({ from: "/sqlite3" });
   const [promise, setPromise] = useState<Promise<AccountRow[]>>(Promise.resolve([]));

   useEffect(() => {
      setPromise(selectAccounts.sqlite.all({ db: remoteClient, params: { filter } }));
   }, [filter]);

   function refresh() {
      setPromise(selectAccounts.sqlite.all({ db: remoteClient, params: { filter } }));
   }

   return (
      <div className="page">
         <h1>Accounts — SQLite3</h1>
         <CreateAccountForm onCreated={(email, firstName, lastName) =>
            insertAccount.sqlite.run({ db: remoteClient, params: { rows: [{ email, firstName, lastName }] } }).then(refresh)
         } />
         <SearchInput placeholder="Search by name or email…" />
         <Suspense fallback={<p className="loading">Loading…</p>}>
            <AccountGrid
               promise={promise}
               onRefresh={refresh}
               onDelete={(accountId) => deleteAccount.sqlite.run({ db: remoteClient, params: { accountId } })}
            />
         </Suspense>
      </div>
   );
}
