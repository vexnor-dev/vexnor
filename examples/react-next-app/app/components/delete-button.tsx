"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function DeleteButton({
   accountId,
   orderCount,
   deleteAction,
}: {
   accountId: string;
   orderCount: number;
   deleteAction: (accountId: string) => Promise<void>;
}) {
   const router = useRouter();
   const [, startTransition] = useTransition();
   const hasOrders = orderCount > 0;

   function handleDelete() {
      deleteAction(accountId).then(() => startTransition(() => router.refresh()));
   }

   return (
      <button
         onClick={handleDelete}
         disabled={hasOrders}
         className="text-sm text-red-500 hover:text-red-700 transition-colors disabled:text-gray-300 disabled:cursor-not-allowed cursor-pointer"
      >
         Delete
      </button>
   );
}
