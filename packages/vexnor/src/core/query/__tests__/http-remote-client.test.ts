import { describe, expect, test } from "vitest";
import { HttpRemoteClient } from "#/core/query/http-remote-client.js";

const request = {
   plugin: "test",
   hash: "abc123",
   params: { id: 1 },
   name: "findById",
   location: null,
};

describe("HttpRemoteClient", () => {
   test("constructor defaults", () => {
      const client = new HttpRemoteClient({ targetUrl: "/api/db" });
      expect(client.targetUrl).toBe("/api/db");
      expect(client.headers).toEqual({});
      expect(client.headerResolver).toBeNull();
      expect(client.fetch).toBeTypeOf("function");
   });

   test("constructor with all options", () => {
      const customFetch = async () => new Response();
      const resolver = async () => ({ Authorization: "Bearer token" });
      const client = new HttpRemoteClient({
         targetUrl: "/api/db",
         headers: { "X-App": "vexnor" },
         headerResolver: resolver,
         fetch: customFetch,
      });
      expect(client.headers).toEqual({ "X-App": "vexnor" });
      expect(client.headerResolver).toBe(resolver);
      expect(client.fetch).toBe(customFetch);
   });

   test("remoteExecute — calls fetch with correct args and returns json", async () => {
      const rows = [{ id: 1 }];
      const mockFetch = async (_url: string | URL | Request, _init?: RequestInit) =>
         new Response(JSON.stringify({ rows }), { status: 200 });

      const client = new HttpRemoteClient({ targetUrl: "/api/db", fetch: mockFetch });
      const result = await client.remoteExecute<{ rows: unknown[] }>(request);
      expect(result).toMatchInlineSnapshot(`
        {
          "rows": [
            {
              "id": 1,
            },
          ],
        }
      `);
   });

   test("remoteExecute — merges static headers and resolved headers", async () => {
      let capturedHeaders: Record<string, string> = {};

      const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
         capturedHeaders = Object.fromEntries(new Headers(init?.headers as Record<string, string>).entries());
         return new Response(JSON.stringify({}), { status: 200 });
      };

      const client = new HttpRemoteClient({
         targetUrl: "/api/db",
         headers: { "X-Static": "yes" },
         headerResolver: async () => ({ Authorization: "Bearer tok" }),
         fetch: mockFetch,
      });

      await client.remoteExecute(request);

      expect(capturedHeaders["x-static"]).toBe("yes");
      expect(capturedHeaders["authorization"]).toBe("Bearer tok");
      expect(capturedHeaders["content-type"]).toBe("application/json");
   });

   test("remoteExecute — throws when response is not ok", async () => {
      const mockFetch = async () => new Response("Forbidden", { status: 403 });
      const client = new HttpRemoteClient({ targetUrl: "/api/db", fetch: mockFetch });
      await expect(client.remoteExecute(request)).rejects.toMatchInlineSnapshot(
         `[Error: Query failed: 403]`,
      );
   });
});
