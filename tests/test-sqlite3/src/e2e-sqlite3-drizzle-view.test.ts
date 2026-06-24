// @ts-nocheck
import { describe, expect, test } from "vitest";
import { sqliteView, text, integer } from "drizzle-orm/sqlite-core";
import { fromDrizzleView } from "@vexnor/drizzle/sqlite";
import { sql, row, param } from "@vexnor/core";
import "@vexnor/sqlite3";
import { db } from "./config.js";

const accountOrderSummaryDrizzle = sqliteView("account_order_summary", {
   accountId: text("account_id"),
   email: text("email"),
   firstName: text("first_name"),
   lastName: text("last_name"),
   status: text("status"),
   orderCount: integer("order_count"),
}).existing();

const View = fromDrizzleView(accountOrderSummaryDrizzle, "main");

describe("e2e drizzle/sqlite — fromDrizzleView against real view", () => {
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
      const results = await sql`SELECT ${row(View.$$)} FROM ${View}`.sqlite.all({ db });
      expect(Array.isArray(results)).toBe(true);
   });

   test("SELECT with WHERE param", async () => {
      const emailParam = param<{ email: string }>("email");
      const results = await sql`
         SELECT ${row(View.$$)} FROM ${View}
         WHERE ${View.$email} = ${emailParam}
      `.sqlite.all({ db, params: { email: "nonexistent@example.com" } });
      expect(results).toHaveLength(0);
   });

   test("SELECT specific columns", async () => {
      const results = await sql`
         SELECT ${row(View.$accountId, View.$email, View.$orderCount)}
         FROM ${View}
      `.sqlite.all({ db });
      expect(Array.isArray(results)).toBe(true);
   });
});
