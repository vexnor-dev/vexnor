import { HttpRemoteClient } from "vexnor";

export const remoteClient = new HttpRemoteClient({
   targetUrl: "/api/db",
});
