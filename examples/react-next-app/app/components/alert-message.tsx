"use client";

import { useEffect } from "react";

export function AlertMessage({
   message,
   onDismiss,
   durationMs = 3000,
}: {
   message: string | null;
   onDismiss: () => void;
   durationMs?: number;
}) {
   useEffect(() => {
      if (!message) return;
      const timer = setTimeout(onDismiss, durationMs);
      return () => clearTimeout(timer);
   }, [durationMs, message, onDismiss]);

   if (!message) return null;

   return (
      <div className="fixed bottom-4 right-4 px-4 py-2 rounded-md bg-green-50 border border-green-200 text-green-700 text-sm shadow-md z-50">
         {message}
      </div>
   );
}
