import { useMemo } from "react";
import { HttpRemoteClient, type RemoteClient } from "vexnor";
import { useAuth } from "./auth-context";

export function useRemoteClient(): RemoteClient {
   const { token } = useAuth();

   return useMemo(
      () =>
         new HttpRemoteClient({
            targetUrl: "/api/db",
            headerResolver: async () => ({
               ...(token ? { Authorization: `Bearer ${token}` } : {}),
            }),
         }),
      [token],
   );
}
