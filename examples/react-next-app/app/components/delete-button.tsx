"use client";

export function DeleteButton({
   accountId,
   orderCount,
   deleteAction,
}: {
   accountId: string;
   orderCount: number;
   deleteAction: (accountId: string) => Promise<void>;
}) {
   const hasOrders = orderCount > 0;

   return (
      <button
         onClick={() => deleteAction(accountId)}
         disabled={hasOrders}
         className="text-sm text-red-500 hover:text-red-700 transition-colors disabled:text-gray-300 disabled:cursor-not-allowed cursor-pointer"
      >
         Delete
      </button>
   );
}
