
export type ConnectionConfig =
   | { uri: string }
   | { host: string; port: number; database: string; user: string; password: string };

export function newConnectionConfig(args: Record<string, unknown>): ConnectionConfig {
   if ("uri" in args) {
      if (typeof args.uri !== "string") {
         throw new Error("uri must be a string");
      }
      return { uri: args.uri };
   }

   const { host, port, database, user, password } = args;

   if (typeof host !== "string") {
      throw new Error("host must be a string");
   }
   if (typeof port !== "number") {
      throw new Error("port must be a number");
   }
   if (typeof database !== "string") {
      throw new Error("database must be a string");
   }
   if (typeof user !== "string") {
      throw new Error("user must be a string");
   }
   if (typeof password !== "string") {
      throw new Error("password must be a string");
   }

   return { host, port, database, user, password };
}