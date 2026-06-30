import { describe, it, expect, vi } from "vitest";
import { sql, row, getQueryMeta, setQueryMeta } from "@vexnor/core";
import { Account } from "@vexnor/core/testing";
import "@vexnor/postgres";

describe("PostgresQueryHandler.serialize() — meta forwarding", () => {
   it("extracts rows/rowCount/command/oid, forwards meta", () => {
      const q = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const handler = q.postgres;
      const input = {
         rows: [{ accountId: "1" }],
         rowCount: 1,
         command: "SELECT",
         oid: 0,
         fields: [{ name: "accountId" }],
      };
      setQueryMeta(input, { sql: "SELECT 1", params: [], duration: 3 });
      const result = handler.serialize(input as never);
      expect(result).toMatchInlineSnapshot(`
        {
          "command": "SELECT",
          "oid": 0,
          "rowCount": 1,
          "rows": [
            {
              "accountId": "1",
            },
          ],
        }
      `);
      const meta = getQueryMeta(result);
      expect(meta).toMatchInlineSnapshot(`
        {
          "duration": 3,
          "params": [],
          "sql": "SELECT 1",
        }
      `);
   });

   it("no meta on input → no meta on output", () => {
      const q = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const handler = q.postgres;
      const input = { rows: [], rowCount: 0, command: "SELECT", oid: 0, fields: [] };
      const result = handler.serialize(input as never);
      const meta = getQueryMeta(result);
      expect(meta).toMatchInlineSnapshot(`undefined`);
   });
});

describe("PostgresQueryHandler.execute() — meta population", () => {
   it("populates meta.sql and meta.params on success", async () => {
      const db = { query: vi.fn(async () => ({ rows: [{ accountId: "1" }], rowCount: 1 })) };
      const q = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const meta = {} as { sql?: string; params?: unknown[] };
      await q.postgres.execute({ db } as never, undefined, meta);
      expect(meta.sql).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
      expect(meta.params).toMatchInlineSnapshot(`[]`);
   });
});

describe("isRetryablePgError — additional codes", () => {
   it("57P01 (admin_shutdown) is retryable", async () => {
      const db = { query: vi.fn(async () => { throw Object.assign(new Error("shutdown"), { code: "57P01" }); }) };
      const q = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const err = await q.postgres.execute({ db } as never).catch((e) => e);
      expect(err.retryable).toMatchInlineSnapshot(`true`);
   });

   it("08006 (connection_failure) is retryable", async () => {
      const db = { query: vi.fn(async () => { throw Object.assign(new Error("fail"), { code: "08006" }); }) };
      const q = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const err = await q.postgres.execute({ db } as never).catch((e) => e);
      expect(err.retryable).toMatchInlineSnapshot(`true`);
   });

   it("08001 (sqlclient_unable_to_establish_sqlconnection) is retryable", async () => {
      const db = { query: vi.fn(async () => { throw Object.assign(new Error("fail"), { code: "08001" }); }) };
      const q = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const err = await q.postgres.execute({ db } as never).catch((e) => e);
      expect(err.retryable).toMatchInlineSnapshot(`true`);
   });

   it("08004 (sqlserver_rejected_establishment_of_sqlconnection) is retryable", async () => {
      const db = { query: vi.fn(async () => { throw Object.assign(new Error("fail"), { code: "08004" }); }) };
      const q = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const err = await q.postgres.execute({ db } as never).catch((e) => e);
      expect(err.retryable).toMatchInlineSnapshot(`true`);
   });
});
