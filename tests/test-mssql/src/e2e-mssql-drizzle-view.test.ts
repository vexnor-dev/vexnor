import { describe, expect, test } from "vitest";
import { mssqlSchema, varchar, nvarchar, int } from "drizzle-orm/mssql-core";
import { fromDrizzleView } from "@vexnor/drizzle/mssql";
import { sql, row, param } from "@vexnor/core";
import "@vexnor/mssql";
import { pool } from "./mssql-pool.js";

const accountOrderSummaryDrizzle = mssqlSchema("vexnor_dev")
   .view("account_order_summary", {
      accountId: varchar("account_id", { length: 36 }),
      email: varchar("email", { length: 255 }),
      firstName: nvarchar("first_name", { length: 50 }),
      lastName: nvarchar("last_name", { length: 50 }),
      status: varchar("status", { length: 20 }),
      orderCount: int("order_count"),
   })
   .existing();

const View = fromDrizzleView(accountOrderSummaryDrizzle);

describe("e2e drizzle/mssql — fromDrizzleView against real view", () => {
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
      const results = await sql`SELECT ${row(View.$$)} FROM ${View}`.mssql.all({ db: pool.request() });
      expect(Array.isArray(results)).toBe(true);
   });

   test("SELECT with WHERE param", async () => {
      const emailParam = param<{ email: string }>("email");
      const results = await sql`
         SELECT ${row(View.$$)} FROM ${View}
         WHERE ${View.$email} = ${emailParam}
      `.mssql.all({ db: pool.request(), params: { email: "nonexistent@example.com" } });
      expect(results).toHaveLength(0);
   });

   test("SELECT specific columns", async () => {
      const results = await sql`
         SELECT ${row(View.$accountId, View.$email, View.$orderCount)}
         FROM ${View}
      `.mssql.all({ db: pool.request() });
      expect(Array.isArray(results)).toBe(true);
   });
});
