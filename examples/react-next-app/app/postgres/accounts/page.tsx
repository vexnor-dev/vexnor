import { pgPool } from "@/shared/db/postgres";
import { getSelectAccountParams, insertAccount, selectAccounts } from "@/shared/queries/postgres";
import { PostgresAccountsGrid } from "@/app/components/postgres-accounts-grid";
import { CreateAccountForm } from "@/app/components/create-account-form";

async function createAccountAction(email: string, firstName: string, lastName: string) {
   "use server";
   await insertAccount.run({ db: pgPool, params: { rows: [{ email, firstName, lastName }] } });
}

export default async function PostgresAccountsPage({
   searchParams,
}: {
   searchParams: Promise<Record<string, string | undefined>>;
}) {
   const sp = await searchParams;
   const params = getSelectAccountParams({
      searchParams: new URLSearchParams(Object.entries(sp).filter(([, v]) => v != null) as [string, string][]),
   });
   const initialAccounts = await selectAccounts.postgres.all({ db: pgPool, params });

   return (
      <div className="max-w-6xl mx-auto px-6 py-10">
         <h1 className="text-2xl font-semibold text-gray-900 mb-6">Accounts — PostgreSQL</h1>
         <CreateAccountForm createAction={createAccountAction} />
         <PostgresAccountsGrid initialAccounts={initialAccounts} initialParams={params} />
      </div>
   );
}
