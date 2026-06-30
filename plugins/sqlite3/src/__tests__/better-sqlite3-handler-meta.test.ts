import { describe, it, expect } from "vitest";
import { sql, row } from "@vexnor/core";
import { Account } from "@vexnor/core/testing";
import { BetterSqlite3QueryHandler } from "#src/better-sqlite3-query-handler.js";
import "#src/sqlite3-augment.js";

describe("BetterSqlite3QueryHandler.execute() — meta population", () => {
   it("populates meta.sql and meta.params on success (read mode)", async () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const handler = new BetterSqlite3QueryHandler(query as never);
      const fakeDb = {
         prepare: () => ({
            all: () => [{ accountId: "1" }],
            run: () => ({ changes: 0, lastInsertRowid: 0 }),
         }),
      };
      const meta = {} as { sql?: string; params?: unknown[] };
      await handler.execute({ db: fakeDb as never }, "read", meta);
      expect(meta.sql).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
      expect(meta.params).toMatchInlineSnapshot(`[]`);
   });

   it("populates meta.sql and meta.params on success (write mode)", async () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const handler = new BetterSqlite3QueryHandler(query as never);
      const fakeDb = {
         prepare: () => ({
            all: () => [],
            run: () => ({ changes: 1, lastInsertRowid: 42 }),
         }),
      };
      const meta = {} as { sql?: string; params?: unknown[] };
      await handler.execute({ db: fakeDb as never }, "write", meta);
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

describe("isRetryableSqliteError — SQLITE_LOCKED", () => {
   it("SQLITE_LOCKED is retryable", async () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const handler = new BetterSqlite3QueryHandler(query as never);
      const fakeDb = {
         prepare: () => {
            throw Object.assign(new Error("database table is locked"), { code: "SQLITE_LOCKED" });
         },
      };
      const err = await handler.execute({ db: fakeDb as never }, "read").catch((e) => e);
      expect(err.retryable).toMatchInlineSnapshot(`true`);
   });
});
