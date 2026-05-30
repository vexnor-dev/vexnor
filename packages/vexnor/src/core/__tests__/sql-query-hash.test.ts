import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { param } from "#/core/query/sql-param.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";

describe("SqlQuery.hash", () => {
   test("returns a sha-256 hex string", async () => {
      const q = sql`select ${row(Account.$$)} from ${Account}`;
      const hash = await q.hash;
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
   });

   test("same query produces same hash", async () => {
      const q1 = sql`select ${row(Account.$$)} from ${Account}`;
      const q2 = sql`select ${row(Account.$$)} from ${Account}`;
      expect(await q1.hash).toBe(await q2.hash);
   });

   test("different interpolated values produce different hashes", async () => {
      const q1 = sql`select ${row(Account.$accountId)} from ${Account}`;
      const q2 = sql`select ${row(Account.$email)} from ${Account}`;
      expect(await q1.hash).not.toBe(await q2.hash);
   });

   test("different param names produce different hashes", async () => {
      const q1 = sql`select ${row(Account.$$)} from ${Account} where ${Account.$email} = ${param<{ email: string }>("email")}`;
      const q2 = sql`select ${row(Account.$$)} from ${Account} where ${Account.$email} = ${param<{ mail: string }>("mail")}`;
      expect(await q1.hash).not.toBe(await q2.hash);
   });

   test("different tables produce different hashes", async () => {
      const q1 = sql`select * from ${Account}`;
      const q2 = sql`select * from ${Order}`;
      expect(await q1.hash).not.toBe(await q2.hash);
   });

   test("hash is stable across multiple calls", async () => {
      const q = sql`select ${row(Account.$$)} from ${Account}`;
      const h1 = await q.hash;
      const h2 = await q.hash;
      expect(h1).toBe(h2);
   });
});
