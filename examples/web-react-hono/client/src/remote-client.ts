import type { RemoteClient } from "vexnor";

export const remoteClient: RemoteClient = {
   remoteExecute: async ({ plugin, hash, params }) => {
      const response = await fetch("/api/db", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ plugin, hash, params }),
      });
      if (!response.ok) throw new Error(`Query failed: ${response.status}`);
      return response.json();
   },
};
