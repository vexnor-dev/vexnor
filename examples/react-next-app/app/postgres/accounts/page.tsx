import { pgPool } from "@/shared/db/postgres";
import { deleteAccount, insertAccount, selectAccounts } from "@/shared/queries/postgres";
import { AccountTable } from "@/app/components/account-table";
import { CreateAccountForm } from "@/app/components/create-account-form";
import { SearchInput } from "@/app/components/search-input";

export const dynamic = "force-dynamic";

async function deleteAccountAction(accountId: string) {
   "use server";
   await deleteAccount.postgres.run({ db: pgPool, params: { accountId } });
}

async function createAccountAction(email: string, firstName: string, lastName: string) {
   "use server";
   await insertAccount.postgres.run({ db: pgPool, params: { rows: [{ email, firstName, lastName }] } });
}

export default async function PostgresAccountsPage({
   searchParams,
}: {
   searchParams: Promise<{ filter?: string }>;
}) {
   const { filter } = await searchParams;
   const accounts = await selectAccounts.postgres
      .all({ db: pgPool, params: { filter } });

   return (
      <div className="max-w-6xl mx-auto px-6 py-10">
         <h1 className="text-2xl font-semibold text-gray-900 mb-6">Accounts — PostgreSQL</h1>
         <CreateAccountForm createAction={createAccountAction} />
         <SearchInput defaultValue={filter ?? ""} />
         <AccountTable accounts={accounts} deleteAction={deleteAccountAction} />
      </div>
   );
}
