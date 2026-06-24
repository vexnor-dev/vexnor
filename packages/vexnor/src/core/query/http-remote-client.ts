import type { QueryMeta, RemoteClient } from "#/core/query/sql-query-types.js";
import { setQueryMeta } from "#/core/query/query-meta-store.js";

type HeaderRecord = Record<string, string>;

export type HttpRemoteClientHeaderResolver = (
   request: Parameters<RemoteClient["remoteExecute"]>[0],
) => HeaderRecord | Promise<HeaderRecord>;

export type HttpRemoteClientOptions = {
   targetUrl: string;
   headers?: HeaderRecord;
   headerResolver?: HttpRemoteClientHeaderResolver;
   fetch?: typeof globalThis.fetch;
};

export class HttpRemoteClient implements RemoteClient {
   readonly targetUrl: string;
   readonly headers: HeaderRecord;
   readonly headerResolver: HttpRemoteClientHeaderResolver | null;
   readonly fetch: typeof globalThis.fetch;

   constructor(options: HttpRemoteClientOptions) {
      this.targetUrl = options.targetUrl;
      this.headers = options.headers ?? {};
      this.headerResolver = options.headerResolver ?? null;
      this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
   }

   async remoteExecute<TResult>(request: Parameters<RemoteClient["remoteExecute"]>[0]): Promise<TResult> {
      const resolvedHeaders = this.headerResolver ? await this.headerResolver(request) : {};
      const start = performance.now();
      const response = await this.fetch(this.targetUrl, {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
            ...this.headers,
            ...resolvedHeaders,
         },
         body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error(`Query failed: ${response.status}`);
      const json = await response.json();
      const sqlHeader = response.headers.get("x-query-sql");
      const sql = sqlHeader
         ? (typeof atob === "function" ? atob(sqlHeader) : Buffer.from(sqlHeader, "base64").toString())
         : undefined;
      const meta: QueryMeta = { sql, duration: performance.now() - start };
      setQueryMeta(json, meta);
      return json as TResult;
   }
}
