import { describe, expect, test } from "vitest";
import { pgSchema, uuid, varchar, bigint } from "drizzle-orm/pg-core";
import { fromDrizzleView } from "valnor-drizzle/pg";
import { sql, row, param } from "valnor";
import "valnor-postgres";
import { pool } from "./postgres-pool.js";

const accountOrderSummaryDrizzle = pgSchema("valnor_test")
   .view("account_order_summary", {
      accountId: uuid("account_id"),
      email: varchar("email"),
      firstName: varchar("first_name"),
      lastName: varchar("last_name"),
      status: varchar("status"),
      orderCount: bigint("order_count", { mode: "number" }),
   })
   .existing();

const View = fromDrizzleView(accountOrderSummaryDrizzle);

describe("e2e drizzle/pg — fromDrizzleView against real view", () => {
   test("crud is select-only", () => {
      expect(View.crud).toMatchInlineSnapshot(`
        {
          "delete": false,
          "insert": false,
          "select": true,
          "update": false,
        }
      `);
   });

   test("SELECT all columns", async () => {
      const results = await sql`SELECT ${row(View.$$)} FROM ${View}`.postgres.all({ db: pool });
      expect(Array.isArray(results)).toBe(true);
   });

   test("SELECT with WHERE param", async () => {
      const emailParam = param<{ email: string }>("email");
      const results = await sql`
         SELECT ${row(View.$$)} FROM ${View}
         WHERE ${View.$email} = ${emailParam}
      `.postgres.all({ db: pool, params: { email: "nonexistent@example.com" } });
      expect(results).toHaveLength(0);
   });

   test("SELECT specific columns", async () => {
      const results = await sql`
         SELECT ${row(View.$accountId, View.$email, View.$orderCount)}
         FROM ${View}
      `.postgres.all({ db: pool });
      expect(Array.isArray(results)).toBe(true);
   });
});
