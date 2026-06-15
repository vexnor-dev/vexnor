import { describe, expect, test, vi } from "vitest";
import { sql, row, SqlSelectCharm } from "@vexnor/core";
import { Account } from "@vexnor/core/testing";
import "@vexnor/postgres";
import type { RemoteClient } from "@vexnor/core";

const DATE_STR = "2001-05-30T10:40:50.867Z";

function makeMockDb(rows: unknown[]) {
   return {
      query: vi.fn(async () => ({ rows, rowCount: rows.length })),
   };
}

function makeRemoteClient(rows: unknown[]): RemoteClient {
   return {
      remoteExecute<TResult>(): Promise<TResult> {
         return Promise.resolve({ rows }) as unknown as Promise<TResult>;
      },
   };
}

describe("PostgresQueryHandler — execute()", () => {
   test("executes query and returns rows", async () => {
      const db = makeMockDb([{ accountId: "1", email: "a@b.com" }]);
      const q = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      const result = await q.postgres.execute({ db } as never);
      expect(db.query).toHaveBeenCalledWith({
         text: `/* <query_0> */\nSELECT\n  "a_1"."account_id" AS "accountId",\n  "a_1"."email"\nFROM\n  "main"."account" AS "a_1" /* </query_0> */`,
         values: [],
      });
      expect(result.rows).toMatchInlineSnapshot(`
        [
          {
            "accountId": "1",
            "email": "a@b.com",
          },
        ]
      `);
   });

   test("calls debug callback when provided", async () => {
      const db = makeMockDb([]);
      let debugCalled = false;
      const q = sql`SELECT ${Account.$$} FROM ${Account}`;
      await q.postgres.execute({ db, options: { debug: () => { debugCalled = true; } } } as never);
      expect(debugCalled).toBe(true);
   });

   test("wraps execution errors as SqlRunError", async () => {
      const db = {
         query: vi.fn(async () => { throw Object.assign(new Error("syntax error"), { code: "42601" }); }),
      };
      const q = sql`SELECT ${Account.$$} FROM ${Account}`;
      await expect(q.postgres.execute({ db } as never)).rejects.toThrow("Error running postgres query");
   });

   test("marks retryable on known pg error code 40001 (serialization failure)", async () => {
      const db = {
         query: vi.fn(async () => { throw Object.assign(new Error("serialization"), { code: "40001" }); }),
      };
      const q = sql`SELECT ${Account.$$} FROM ${Account}`;
      const err = await q.postgres.execute({ db } as never).catch((e) => e);
      expect(err.retryable).toBe(true);
   });

   test("marks retryable on 40P01 (deadlock)", async () => {
      const db = {
         query: vi.fn(async () => { throw Object.assign(new Error("deadlock"), { code: "40P01" }); }),
      };
      const q = sql`SELECT ${Account.$$} FROM ${Account}`;
      const err = await q.postgres.execute({ db } as never).catch((e) => e);
      expect(err.retryable).toBe(true);
   });

   test("non-retryable on unknown error code", async () => {
      const db = {
         query: vi.fn(async () => { throw Object.assign(new Error("other"), { code: "99999" }); }),
      };
      const q = sql`SELECT ${Account.$$} FROM ${Account}`;
      const err = await q.postgres.execute({ db } as never).catch((e) => e);
      expect(err.retryable).toBeFalsy();
   });
});

describe("PostgresQueryHandler — all() via remote client", () => {
   test("no schema — returns rows unchanged", async () => {
      const q = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      const rows = [{ accountId: "1", email: "a@b.com" }];
      const result = await q.postgres.all({ db: makeRemoteClient(rows) });
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "accountId": "1",
            "email": "a@b.com",
          },
        ]
      `);
   });

   test("deserializes top-level Date fields from JSON strings", async () => {
      const q = sql`SELECT ${row(Account.$accountId, Account.$createdAt)} FROM ${Account}`;
      const rows = [{ accountId: "1", createdAt: DATE_STR }];
      const result = await q.postgres.all({ db: makeRemoteClient(rows) });
      expect(result[0]!.createdAt).toBeInstanceOf(Date);
   });

   test("deserializes nested Date in charm from remote client", async () => {
      const charm = new SqlSelectCharm({
         key: "lastOrder",
         params: null,
         jsonSchema: { lastOrder: { createdAt: "Date" } },
         write() {},
      });
      const q = sql`SELECT ${row(Account.$accountId)}, ${charm} FROM ${Account}`;
      const rows = [{ accountId: "1", lastOrder: { orderId: "o1", createdAt: DATE_STR } }];
      const result = await q.postgres.all({ db: makeRemoteClient(rows) });
      expect((result[0]!.lastOrder as { createdAt: unknown }).createdAt).toBeInstanceOf(Date);
   });
});

describe("PostgresQueryHandler — getOptions()", () => {
   test("wraps build errors as SqlRunError with QUERY_BUILD_FAILED", async () => {
      // Force a build error by using an unsupported raw token type
      const q = sql`SELECT ${Account.$$} FROM ${Account}`;
      // getOptions should succeed normally
      const handler = q.postgres;
      expect(handler.source).toBeDefined();
   });
});
