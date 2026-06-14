"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";

export function CreateAccountForm({
   createAction,
}: {
   createAction: (email: string, firstName: string, lastName: string) => Promise<void>;
}) {
   const router = useRouter();
   const [error, submitAction, pending] = useActionState(async (_: unknown, formData: FormData) => {
      const email = formData.get("email") as string;
      const firstName = formData.get("firstName") as string;
      const lastName = formData.get("lastName") as string;
      await createAction(email, firstName, lastName);
      router.refresh();
      return null;
   }, null);

   return (
      <form action={submitAction} className="flex gap-3 mb-8 flex-wrap">
         <input name="email" placeholder="Email" required className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 w-56" />
         <input name="firstName" placeholder="First name" required className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 w-36" />
         <input name="lastName" placeholder="Last name" required className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 w-36" />
         <button type="submit" disabled={pending} className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {pending ? "Creating..." : "Create"}
         </button>
         {error && <p className="text-red-500 text-sm w-full">{String(error)}</p>}
      </form>
   );
}
