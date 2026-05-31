import "vexnor-mssql";
import { Suspense, useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { deleteAccount, insertAccount, selectAccounts } from "#shared/queries/mssql";
import { AccountGrid } from "#/components/account-grid.js";
import { CreateAccountForm } from "#/components/create-account-form.js";
import { SearchInput } from "#/components/search-input.js";
import type { AccountRow } from "#/components/account-row";
import { useRemoteClient } from "#/use-remote-client";

export default function MssqlAccountsPage() {
   const remoteClient = useRemoteClient();
   const { filter } = useSearch({ from: "/mssql" });
   const [promise, setPromise] = useState<Promise<AccountRow[]>>(Promise.resolve([]));

   useEffect(() => {
      setPromise(selectAccounts.mssql.all({ db: remoteClient, params: { filter } }));
   }, [filter]);

   function refresh() {
      setPromise(selectAccounts.mssql.all({ db: remoteClient, params: { filter } }));
   }

   return (
      <div className="page">
         <h1>Accounts — MS SQL Server</h1>
         <CreateAccountForm
            onCreated={(email, firstName, lastName) =>
               insertAccount.mssql
                  .run({ db: remoteClient, params: { rows: [{ email, firstName, lastName }] } })
                  .then(refresh)
            }
         />
         <SearchInput placeholder="Search by name or email…" />
         <Suspense fallback={<p className="loading">Loading…</p>}>
            <AccountGrid
               promise={promise}
               onRefresh={refresh}
               onDelete={(accountId) => deleteAccount.mssql.run({ db: remoteClient, params: { accountId } })}
            />
         </Suspense>
      </div>
   );
}
