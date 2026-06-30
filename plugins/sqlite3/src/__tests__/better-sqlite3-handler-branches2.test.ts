import { describe, expect, test } from "vitest";
import { param, row, sql } from "@vexnor/core";
import { Account } from "@vexnor/core/testing";
import { BetterSqlite3QueryHandler } from "#src/better-sqlite3-query-handler.js";
import "#src/sqlite3-augment.js";

describe("BetterSqlite3QueryHandler — branches", () => {
   test("resolveRows throws — not supported for better-sqlite3", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const handler = new BetterSqlite3QueryHandler(query as never);
      expect(() => handler.resolveRows({ rows: [] })).toThrow("Method not supported");
   });

   test("isReadResult returns true for object with rows array", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const handler = new BetterSqlite3QueryHandler(query as never);
      expect(handler.isReadResult({ rows: [] })).toBe(true);
   });

   test("isReadResult returns false for null", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const handler = new BetterSqlite3QueryHandler(query as never);
      expect(handler.isReadResult(null)).toBe(false);
   });

   test("isReadResult returns false for non-object", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const handler = new BetterSqlite3QueryHandler(query as never);
      expect(handler.isReadResult("string")).toBe(false);
   });

   test("isReadResult returns false for object without rows", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const handler = new BetterSqlite3QueryHandler(query as never);
      expect(handler.isReadResult({ changes: 1 })).toBe(false);
   });

   test("isReadResult returns false for object with non-array rows", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const handler = new BetterSqlite3QueryHandler(query as never);
      expect(handler.isReadResult({ rows: "not-array" })).toBe(false);
   });

   test("deserialize passes through non-read result unchanged", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const handler = new BetterSqlite3QueryHandler(query as never);
      const result = { changes: 1, lastInsertRowid: 1 };
      expect(handler.deserialize(result as never)).toBe(result);
   });

   test("deserialize processes read result rows", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const handler = new BetterSqlite3QueryHandler(query as never);
      const result = { rows: [{ accountId: "1", email: "test@test.com" }] };
      const deserialized = handler.deserialize(result as never);
      expect(deserialized.rows).toBeDefined();
   });

   test("getOptions throws SqlRunError on build failure", () => {
      // Create a query that will fail during getSql due to missing params
      const query = sql`SELECT * FROM ${Account} WHERE ${Account.$accountId} = ${param<{ id: string }>("id")}`;
      const handler = new BetterSqlite3QueryHandler(query as never);
      expect(() => handler.getOptions({ db: {} as never })).toThrow("Error building sqlite query");
   });

   test("execute throws SqlRunError on DB execution failure", async () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const handler = new BetterSqlite3QueryHandler(query as never);
      const fakeDb = {
         prepare: () => {
            throw Object.assign(new Error("DB locked"), { code: "SQLITE_BUSY" });
         },
      };
      await expect(handler.execute({ db: fakeDb as never }, "read")).rejects.toThrow(
         "Error running SQLITE3 query",
      );
   });

   test("execute marks retryable errors with correct code", async () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const handler = new BetterSqlite3QueryHandler(query as never);
      const fakeDb = {
         prepare: () => {
            throw Object.assign(new Error("DB locked"), { code: "SQLITE_BUSY" });
         },
      };
      try {
         await handler.execute({ db: fakeDb as never }, "read");
      } catch (err: unknown) {
         expect((err as { retryable: boolean }).retryable).toBe(true);
      }
   });

   test("execute marks non-retryable errors correctly", async () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const handler = new BetterSqlite3QueryHandler(query as never);
      const fakeDb = {
         prepare: () => {
            throw new Error("syntax error");
         },
      };
      try {
         await handler.execute({ db: fakeDb as never }, "read");
      } catch (err: unknown) {
         expect((err as { retryable: boolean }).retryable).toBe(false);
      }
   });
});
