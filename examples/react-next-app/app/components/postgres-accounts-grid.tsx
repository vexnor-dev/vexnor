"use client";

import { useRef, useState, useTransition } from "react";
import { AccountOrderBy, deleteAccount, selectAccounts, SelectAccountsParams } from "@/shared/queries/postgres";
import { AccountTable } from "./account-table";
import { AlertMessage } from "./alert-message";
import { useRemoteClient } from "@/app/components/use-remote-client";
import { TypeOf } from "vexnor";
import { Account } from "@/shared/codegen/postgres/vexnor_dev.account-table";
import { SearchInput } from "@/app/components/search-input";
import { OrderDirection } from "@/shared/queries/params";

const FILTER_DEBOUNCE_MS = 300;

type AccountRow = TypeOf<typeof selectAccounts>;

export function PostgresAccountsGrid({
   initialAccounts,
   initialParams,
}: {
   initialAccounts: AccountRow[];
   initialParams: SelectAccountsParams;
}) {
   const remoteClient = useRemoteClient();
   const [isPending, startTransition] = useTransition();

   const [params, setParams] = useState<SelectAccountsParams>(initialParams);
   const [filterInput, setFilterInput] = useState(initialParams.filter ?? "");
   const [accounts, setAccounts] = useState<AccountRow[]>(initialAccounts);
   const [alert, setAlert] = useState<string | null>(null);
   const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

   function refetch(nextParams: SelectAccountsParams) {
      startTransition(async () => {
         const result = await selectAccounts.postgres.all({ db: remoteClient, params: nextParams });
         setAccounts(result);
      });
      const url = new URLSearchParams();
      if (nextParams.filter) url.set("filter", nextParams.filter);
      if (nextParams.accountOrderBy) url.set("accountOrderBy", nextParams.accountOrderBy);
      if (nextParams.orderDir) url.set("orderDir", nextParams.orderDir);
      window.history.replaceState(null, "", `?${url.toString()}`);
   }

   function handleFilterChange(value: string) {
      setFilterInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
         const next = { ...params, filter: value || undefined };
         setParams(next);
         refetch(next);
      }, FILTER_DEBOUNCE_MS);
   }

   function handleOrderChange(accountOrderBy: AccountOrderBy, orderDir: OrderDirection) {
      const next = { ...params, accountOrderBy, orderDir };
      setParams(next);
      refetch(next);
   }

   async function handleDelete(accountId: string) {
      const email = accounts.find((a) => a.accountId === accountId)?.email ?? accountId;
      const { rowCount } = await deleteAccount.run({ db: remoteClient, params: { accountId } });
      setAlert(`Account ${email} deleted.`);
      refetch(params);
      return {
         deleted: rowCount === 1,
         refresh: false,
      };
   }

   return (
      <>
         <AlertMessage message={alert} onDismiss={() => setAlert(null)} />
         <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px] items-start">
            <SearchInput defaultValue={filterInput} onChange={handleFilterChange} />
            <div className="relative">
               <select
                  value={`${params.accountOrderBy}:${params.orderDir}`}
                  onChange={(e) => {
                     const [nextField, nextDir] = e.target.value.split(":");
                     handleOrderChange(nextField as AccountOrderBy, nextDir as OrderDirection);
                  }}
                  className={`w-full border border-gray-300 rounded-md px-3 py-2 pr-8 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-gray-400 ${isPending ? "opacity-60" : ""}`}
               >
                  <option value={`${Account.$createdAt.columnName}:DESC`}>Newest First</option>
                  <option value={`${Account.$createdAt.columnName}:ASC`}>Oldest First</option>
                  <option value={`${Account.$email.columnName}:ASC`}>Email A-Z</option>
                  <option value={`${Account.$email.columnName}:DESC`}>Email Z-A</option>
               </select>
               <svg
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
               >
                  <path
                     d="M3 5L7 9L11 5"
                     stroke="currentColor"
                     strokeWidth="1.5"
                     strokeLinecap="round"
                     strokeLinejoin="round"
                  />
               </svg>
            </div>
         </div>
         <div className={isPending ? "opacity-60 transition-opacity" : ""}>
            <AccountTable accounts={accounts} deleteAction={handleDelete} />
         </div>
      </>
   );
}
