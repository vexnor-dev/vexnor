import { mongoDb } from "@/shared/db/mongodb";
import { findAccounts, deleteAccount, insertAccount } from "@/shared/queries/mongodb";
import { MongoAccountsGrid } from "@/app/components/mongo-accounts-grid";
import { CreateAccountForm } from "@/app/components/create-account-form";

async function createAccountAction(email: string, firstName: string, lastName: string) {
   "use server";
   await insertAccount.all({
      db: mongoDb,
      params: {
         doc: {
            _id: crypto.randomUUID(),
            status: "created" as const,
            email,
            name: { first: firstName, last: lastName },
            notes: null,
            createdAt: new Date(),
            modifiedAt: new Date(),
         },
      },
   });
}

export default async function MongoDBAccountsPage({
   searchParams,
}: {
   searchParams: Promise<Record<string, string | undefined>>;
}) {
   const sp = await searchParams;
   const status = sp.status ?? "confirmed";
   const limit = Number(sp.limit ?? 50);

   const initialAccounts = await findAccounts.all({
      db: mongoDb,
      params: { status, limit },
   });

   return (
      <div className="max-w-6xl mx-auto px-6 py-10">
         <h1 className="text-2xl font-semibold text-gray-900 mb-6">Accounts — MongoDB</h1>
         <CreateAccountForm createAction={createAccountAction} />
         <MongoAccountsGrid initialAccounts={initialAccounts} />
      </div>
   );
}
