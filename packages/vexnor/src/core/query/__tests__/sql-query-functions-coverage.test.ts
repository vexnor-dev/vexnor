import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { param, ctx } from "#/core/query/sql-param.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";
import { col } from "#/core/query/sql-select-column.js";

describe("SqlQuery — uncovered function paths", () => {
   test("rowType getter throws", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      expect(() => query.rowType).toThrow("this property is only for fetching the row type");
   });

   test("authorize() returns clone with merged tags", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const authorized = query.authorize("admin", "superuser");
      expect(authorized.authorization).toMatchInlineSnapshot(`
        [
          "admin",
          "superuser",
        ]
      `);
      // original unaffected
      expect(query.authorization).toMatchInlineSnapshot(`[]`);
   });

   test("authorize() merges tags from subqueries", () => {
      const inner = sql`SELECT ${row(Order.$$)} FROM ${Order}`.authorize("user");
      const outer = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE EXISTS (${inner})`.authorize("admin");
      expect(outer.authorization).toMatchInlineSnapshot(`
        [
          "admin",
          "user",
        ]
      `);
   });

   test("render() returns SqlQueryRef with queryFormat", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const ref = query.render("with", "main");
      expect(ref).toBeDefined();
      expect(ref.innerQuery).toBe(query);
   });

   test("inline() returns SqlQueryRef with inline queryType", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const ref = query.inline("from");
      expect(ref).toBeDefined();
      expect(ref.innerQuery).toBe(query);
   });

   test("inline() without format argument", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const ref = query.inline();
      expect(ref).toBeDefined();
      expect(ref.innerQuery).toBe(query);
   });

   test("getContext() returns only context params", () => {
      const query = sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}
         AND ${Account.$email} = ${param<{ email: string }>("email")}
      `;
      const context = query.getContext({ userId: "abc", email: "test@test.com" });
      expect(context).toMatchInlineSnapshot(`
        {
          "userId": "abc",
        }
      `);
   });

   test("getContext() throws when query has no params", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      expect(() => query.getContext({} as never)).toThrow();
   });

   test("getContext() throws when args is null/undefined", () => {
      const query = sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}
      `;
      expect(() => query.getContext(null as never)).toThrow();
   });

   test("hash returns consistent SHA-256", async () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const hash = await query.hash;
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      // calling again returns same value
      expect(await query.hash).toBe(hash);
   });

   test("hash includes context param names", async () => {
      const q1 = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}`;
      const q2 = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${param<{ userId: string }>("userId")}`;
      const hash1 = await q1.hash;
      const hash2 = await q2.hash;
      expect(hash1).not.toBe(hash2);
   });

   test("jsonSchema aggregates from row columns", () => {
      const query = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      expect(query.jsonSchema).toBeDefined();
   });

   test("$$ returns SqlSelectAll for query", () => {
      const query = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      expect(query.$$).toBeDefined();
   });

   test("out returns SqlQueryRef with out=true", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const ref = query.out;
      expect(ref).toBeDefined();
      expect(ref.innerQuery.id).toBe(query.id);
   });

   test("label falls back to rawStrings-based description", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      expect(query.label).toBeDefined();
      expect(typeof query.label).toBe("string");
   });

   test("dialects inferred from table", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      expect(query.dialects.size).toBeGreaterThan(0);
   });

   test("initContext returns null when params is null", () => {
      const query = sql`SELECT 1`;
      expect(query.context).toBeNull();
   });

   test("newSqlQuery proxy has() for row key", () => {
      const query = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      expect("$accountId" in query).toBe(true);
      expect("$nonExistent" in query).toBe(false);
   });

   test("newSqlQuery proxy getOwnPropertyDescriptor for row key", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const desc = Object.getOwnPropertyDescriptor(query, "$accountId");
      expect(desc).toBeDefined();
   });

   test("newSqlQuery proxy getOwnPropertyDescriptor for non-existent key", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const desc = Object.getOwnPropertyDescriptor(query, "$nonExistent");
      expect(desc).toBeUndefined();
   });

   test("newSqlQuery proxy get for non-existent key returns undefined", () => {
      const query = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      expect((query as unknown as Record<string, unknown>)["$nonExistent"]).toBeUndefined();
   });

   test("col() simple key", () => {
      const column = col<{ total: number }>("total");
      expect(column.key).toBe("total");
      expect(column.onWrite).toBeNull();
   });

   test("col() with onWrite handler", () => {
      const column = col<{ total: number }, Record<string, never>>(
         "total",
         (ctx) => ctx.addStrings("COUNT(*)"),
         null as never,
      );
      expect(column.key).toBe("total");
      expect(column.onWrite).toBeDefined();
   });
});
