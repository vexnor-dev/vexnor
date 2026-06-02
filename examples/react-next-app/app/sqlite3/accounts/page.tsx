import { sqliteDb } from "@/shared/db/sqlite3";
import { deleteAccount, insertAccount, selectAccounts } from "@/shared/queries/sqlite3";
import { AccountTable } from "@/app/components/account-table";
import { CreateAccountForm } from "@/app/components/create-account-form";
import { SearchInput } from "@/app/components/search-input";

export const dynamic = "force-dynamic";

async function deleteAccountAction(accountId: string) {
   "use server";
   const result = await deleteAccount.sqlite.run({ db: sqliteDb, params: { accountId } });
   return {
      deleted: Boolean(result.changes === 1),
      refresh: true,
   };
}

async function createAccountAction(email: string, firstName: string, lastName: string) {
   "use server";
   await insertAccount.sqlite.run({ db: sqliteDb, params: { rows: [{ email, firstName, lastName }] } });
}

export default async function Sqlite3AccountsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
   const { filter } = await searchParams;
   const accounts = await selectAccounts.sqlite.all({ db: sqliteDb, params: { filter } });

   return (
      <div className="max-w-6xl mx-auto px-6 py-10">
         <h1 className="text-2xl font-semibold text-gray-900 mb-6">Accounts — SQLite3</h1>
         <CreateAccountForm createAction={createAccountAction} />
         <SearchInput defaultValue={filter ?? ""} />
         <AccountTable accounts={accounts} deleteAction={deleteAccountAction} />
      </div>
   );
}
