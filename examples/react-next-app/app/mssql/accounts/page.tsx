import { getMssqlPool } from "@/shared/db/mssql";
import { deleteAccount, insertAccount, selectAccounts } from "@/shared/queries/mssql";
import { AccountTable } from "@/app/components/account-table";
import { CreateAccountForm } from "@/app/components/create-account-form";
import { SearchInput } from "@/app/components/search-input";

export const dynamic = "force-dynamic";

async function deleteAccountAction(accountId: string) {
   "use server";
   const pool = await getMssqlPool();
   const { rowsAffected } = await deleteAccount.run({ db: pool.request(), params: { accountId } });
   return {
      deleted: Boolean(rowsAffected.length && rowsAffected[0] === 1),
      refresh: true,
   };
}

async function createAccountAction(email: string, firstName: string, lastName: string) {
   "use server";
   const pool = await getMssqlPool();
   await insertAccount.run({ db: pool.request(), params: { rows: [{ email, firstName, lastName }] } });
}

export default async function MssqlAccountsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
   const { filter } = await searchParams;
   const pool = await getMssqlPool();
   const accounts = await selectAccounts.mssql.all({
      db: pool.request(),
      params: { filter },
   });

   return (
      <div className="max-w-6xl mx-auto px-6 py-10">
         <h1 className="text-2xl font-semibold text-gray-900 mb-6">Accounts — MS SQL Server</h1>
         <CreateAccountForm createAction={createAccountAction} />
         <SearchInput defaultValue={filter ?? ""} />
         <AccountTable accounts={accounts} deleteAction={deleteAccountAction} />
      </div>
   );
}
