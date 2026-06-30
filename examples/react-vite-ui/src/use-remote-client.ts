import { useMemo } from "react";
import { HttpRemoteClient, type RemoteClient } from "@vexnor/core";
import { useAuth, type DbKey } from "./auth-context.js";

export function useRemoteClient(db: DbKey): RemoteClient {
   const { token } = useAuth(db);

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
