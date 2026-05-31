import { useMemo } from "react";
import type { RemoteClient } from "vexnor";
import { useAuth } from "./auth-context.js";

export function useRemoteClient(): RemoteClient {
   const { token } = useAuth();

   return useMemo(
      () => ({
         remoteExecute: async ({ plugin, hash, params }) => {
            const response = await fetch("/api/db", {
               method: "POST",
               headers: {
                  "Content-Type": "application/json",
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
               },
               body: JSON.stringify({ plugin, hash, params }),
            });
            if (!response.ok) throw new Error(`Query failed: ${response.status}`);
            return response.json();
         },
      }),
      [token],
   );
}
