import { AccountTable } from "@/app/components/account-table";
import { CreateAccountForm } from "@/app/components/create-account-form";
import { SearchInput } from "@/app/components/search-input";
import { getDuckDb } from "@/shared/db/duckdb";
import { deleteAccount, insertAccount, selectAccounts } from "@/shared/queries/duckdb";

export const dynamic = "force-dynamic";

async function deleteAccountAction(accountId: string) {
   "use server";
   const deleted = await deleteAccount.one({ db: getDuckDb(), params: { accountId } });
   return {
      deleted: deleted.accountId === accountId,
      refresh: true,
   };
}

async function createAccountAction(email: string, firstName: string, lastName: string) {
   "use server";
   await insertAccount.run({ db: getDuckDb(), params: { rows: [{ email, firstName, lastName }] } });
}

export default async function DuckDBAccountsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
   const { filter } = await searchParams;
   const accounts = await selectAccounts.duckdb.all({ db: getDuckDb(), params: { filter } });

   return (
      <div className="max-w-6xl mx-auto px-6 py-10">
         <h1 className="text-2xl font-semibold text-gray-900 mb-6">Accounts — DuckDB</h1>
         <CreateAccountForm createAction={createAccountAction} />
         <SearchInput defaultValue={filter ?? ""} />
         <AccountTable accounts={accounts} deleteAction={deleteAccountAction} />
      </div>
   );
}
