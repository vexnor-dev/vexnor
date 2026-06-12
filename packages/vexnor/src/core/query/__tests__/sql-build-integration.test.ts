import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { param } from "#/core/query/sql-param.js";
import { col } from "#/core/query/sql-select-column.js";
import { val } from "#/core/query/sql-select-value.js";
import { raw } from "#/core/query/sql-raw.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";

describe("SQL build — CTE and recursive patterns", () => {
   test("WITH clause (CTE) generates proper SQL", () => {
      const cte = sql`
         WITH accounts AS (
            SELECT ${row(Account.$accountId, Account.$email)}
            FROM ${Account}
            WHERE ${Account.$status} = ${param<{ status: string }>("status")}
         )
         SELECT * FROM accounts
      `;
      const { text, values } = cte.getSql({ params: { status: "active" } });
      expect(text).toContain("WITH");
      expect(text).toContain("accounts");
      expect(values).toMatchInlineSnapshot(`
        [
          "active",
        ]
      `);
   });

   test("subquery in FROM generates valid SQL", () => {
      const inner = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      const outer = sql`
         SELECT ${row(inner.row!.$accountId)}
         FROM (${inner}) sub
      `;
      const { text } = outer.getSql({ params: {} as never });
      expect(text).toContain("account_id");
   });

   test("val() computed column builds SQL", () => {
      const q = sql`
         SELECT ${row(Account.$accountId)},
                ${val(sql`COUNT(*)`).as<{ total: number }>("total")}
         FROM ${Account}
         GROUP BY ${Account.$accountId}
      `;
      const { text } = q.getSql({ params: {} as never, options: { dialect: "sqlite" } });
      expect(text).toContain("COUNT(*)");
      expect(text).toContain("total");
   });

   test("col() inline column builds SQL", () => {
      const orderCount = col<{ orderCount: number }>("orderCount");
      const q = sql`
         SELECT ${row(Account.$accountId, orderCount)}
         FROM ${Account}
      `;
      const { text } = q.getSql({ params: {} as never, options: { dialect: "sqlite" } });
      expect(text).toContain("orderCount");
   });

   test("multiple params are resolved in order", () => {
      const q = sql`
         SELECT ${row(Account.$accountId)}
         FROM ${Account}
         WHERE ${Account.$email} = ${param<{ email: string }>("email")}
         AND ${Account.$status} = ${param<{ status: string }>("status")}
      `;
      const { values } = q.getSql({ params: { email: "a@b.com", status: "active" } });
      expect(values).toMatchInlineSnapshot(`
        [
          "a@b.com",
          "active",
        ]
      `);
   });

   test("raw SQL injection with raw()", () => {
      const q = sql`
         SELECT ${row(Account.$accountId)}
         FROM ${Account}
         ${raw("ORDER BY account_id DESC")}
      `;
      const { text } = q.getSql({ params: {} as never });
      expect(text).toContain("account_id DESC");
   });
});

describe("SQL build — table aliasing and self-join", () => {
   test("aliased table in self-join", () => {
      const Parent = Account.as("parent");
      const q = sql`
         SELECT ${row(Account.$accountId, Parent.$email.as("parentEmail"))}
         FROM ${Account}
         JOIN ${Parent} ON ${Parent.$accountId} = ${Account.$parentId}
      `;
      const { text } = q.getSql({ params: {} as never, options: { dialect: "sqlite" } });
      expect(text).toContain("parent");
      expect(text).toContain("parentEmail");
   });

   test("query with out column references", () => {
      const subquery = sql`
         SELECT ${row(Order.$orderId, Order.$accountId)}
         FROM ${Order}
         WHERE ${Order.$accountId} = ${Account.out.$accountId}
      `;
      const outer = sql`
         SELECT ${row(Account.$accountId, Account.$email)}
         FROM ${Account}
         WHERE EXISTS (${subquery})
      `;
      const { text } = outer.getSql({ params: {} as never, options: { dialect: "sqlite" } });
      expect(text).toContain("EXISTS");
   });
});

describe("SQL build — inline queries", () => {
   test("inline() flattens a query fragment", () => {
      const whereClause = sql`${Account.$email} = ${param<{ email: string }>("email")}`;
      const q = sql`
         SELECT ${row(Account.$accountId)}
         FROM ${Account}
         WHERE ${whereClause.inline("default")}
      `;
      const { text, values } = q.getSql({ params: { email: "test@example.com" } });
      expect(text).toContain("WHERE");
      expect(values).toContain("test@example.com");
   });
});

describe("SQL build — dialect options", () => {
   test("sqlite dialect uses ? placeholders", () => {
      const q = sql`
         SELECT ${row(Account.$accountId)}
         FROM ${Account}
         WHERE ${Account.$email} = ${param<{ email: string }>("email")}
      `;
      const { text } = q.getSql({ params: { email: "x" }, options: { dialect: "sqlite" } });
      expect(text).toContain("?");
   });

   test("default dialect uses ? placeholders", () => {
      const q = sql`
         SELECT ${row(Account.$accountId)}
         FROM ${Account}
         WHERE ${Account.$email} = ${param<{ email: string }>("email")}
      `;
      const { text } = q.getSql({ params: { email: "x" } });
      expect(text).toContain("?");
   });
});
