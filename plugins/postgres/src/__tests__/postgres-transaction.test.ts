import { describe, expect, test, vi } from "vitest";
import { transaction, savepoint } from "#src/postgres-transaction.js";
import type { Pool, PoolClient } from "pg";

function makeMockClient(): PoolClient & { queries: string[] } {
   const queries: string[] = [];
   return {
      queries,
      query: vi.fn(async (sql: string) => {
         queries.push(sql);
         return { rows: [] };
      }),
      release: vi.fn(),
   } as unknown as PoolClient & { queries: string[] };
}

function makeMockPool(client: PoolClient): Pool {
   return {
      connect: vi.fn(async () => client),
   } as unknown as Pool;
}

describe("transaction (postgres)", () => {
   test("commits on success with default options", async () => {
      const client = makeMockClient();
      const pool = makeMockPool(client);
      const result = await transaction(pool, async (c) => {
         expect(c).toBe(client);
         return 42;
      });
      expect(result).toBe(42);
      expect(client.queries).toMatchInlineSnapshot(`
        [
          "BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE NOT DEFERRABLE",
          "COMMIT",
        ]
      `);
      expect(client.release).toHaveBeenCalledOnce();
   });

   test("rolls back and rethrows on callback error", async () => {
      const client = makeMockClient();
      const pool = makeMockPool(client);
      await expect(
         transaction(pool, async () => {
            throw new Error("boom");
         }),
      ).rejects.toThrow("boom");
      expect(client.queries).toMatchInlineSnapshot(`
        [
          "BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE NOT DEFERRABLE",
          "ROLLBACK",
        ]
      `);
      expect(client.release).toHaveBeenCalledOnce();
   });

   test("uses custom isolation level, access mode, and deferrable", async () => {
      const client = makeMockClient();
      const pool = makeMockPool(client);
      await transaction(pool, async () => "done", {
         isolationLevel: "SERIALIZABLE",
         accessMode: "READ ONLY",
         deferrable: "DEFERRABLE",
      });
      expect(client.queries[0]).toMatchInlineSnapshot(
         `"BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY DEFERRABLE"`,
      );
   });

   test("always releases client even after rollback", async () => {
      const client = makeMockClient();
      const pool = makeMockPool(client);
      await transaction(pool, async () => {
         throw new Error("fail");
      }).catch(() => {});
      expect(client.release).toHaveBeenCalledOnce();
   });
});

describe("savepoint (postgres)", () => {
   test("releases named savepoint on success", async () => {
      const client = makeMockClient();
      const result = await savepoint(client, "sp1", async (c) => {
         expect(c).toBe(client);
         return "saved";
      });
      expect(result).toBe("saved");
      expect(client.queries).toMatchInlineSnapshot(`
        [
          "SAVEPOINT sp1",
          "RELEASE SAVEPOINT sp1",
        ]
      `);
   });

   test("rolls back to named savepoint on error", async () => {
      const client = makeMockClient();
      const result = await savepoint(client, "sp1", async () => {
         throw new Error("fail");
      });
      expect(result).toBeUndefined();
      expect(client.queries).toMatchInlineSnapshot(`
        [
          "SAVEPOINT sp1",
          "ROLLBACK TO SAVEPOINT sp1",
        ]
      `);
   });

   test("auto-generates savepoint name when callback passed directly", async () => {
      const client = makeMockClient();
      await savepoint(client, async () => "ok");
      expect(client.queries[0]).toMatch(/^SAVEPOINT sp_[a-z0-9]+$/);
      expect(client.queries[1]).toMatch(/^RELEASE SAVEPOINT sp_[a-z0-9]+$/);
   });

   test("rolls back to auto-generated savepoint on error", async () => {
      const client = makeMockClient();
      await savepoint(client, async () => {
         throw new Error("fail");
      });
      expect(client.queries[1]).toMatch(/^ROLLBACK TO SAVEPOINT sp_[a-z0-9]+$/);
   });
});
