import "vexnor-postgres";
import { Suspense, useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useRemoteClient } from "#/use-remote-client.js";
import { deleteAccount, insertAccount, selectAccounts } from "#shared/queries/postgres";
import { AccountGrid } from "#/components/account-grid.js";
import { CreateAccountForm } from "#/components/create-account-form.js";
import { SearchInput } from "#/components/search-input.js";
import { AccountRow } from "#/components/account-row";

export default function PostgresAccountsPage() {
   const db = useRemoteClient();
   const { filter } = useSearch({ from: "/postgres" });

   const [promise, setPromise] = useState<Promise<AccountRow[]>>(Promise.resolve([]));

   useEffect(() => {
      setPromise(selectAccounts.postgres.all({ db, params: { filter } }));
   }, [filter]);

   function refresh() {
      setPromise(selectAccounts.postgres.all({ db, params: { filter } }));
   }

   return (
      <div className="page">
         <h1>Accounts — PostgreSQL</h1>
         <CreateAccountForm
            onCreated={(email, firstName, lastName) =>
               insertAccount.postgres.run({ db, params: { rows: [{ email, firstName, lastName }] } }).then(refresh)
            }
         />
         <SearchInput placeholder="Search by name or email…" />
         <Suspense fallback={<p className="loading">Loading…</p>}>
            <AccountGrid
               promise={promise}
               onRefresh={refresh}
               onDelete={(accountId) => deleteAccount.postgres.run({ db, params: { accountId } })}
            />
         </Suspense>
      </div>
   );
}
