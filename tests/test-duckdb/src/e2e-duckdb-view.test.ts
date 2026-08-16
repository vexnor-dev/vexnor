import { describe, expect, test } from "vitest";
import { row } from "@vexnor/core";
import { sql } from "@vexnor/duckdb";
import { AccountOrderSummary } from "./codegen/main.account_order_summary-view.js";
import { db } from "./config.js";
import { insertAccount, insertOrder } from "./fixtures.js";

describe("DuckDB generated view e2e", { concurrent: false }, () => {
   test("marks the generated view as select-only", () => {
      expect(AccountOrderSummary.crud).toMatchInlineSnapshot(`
        {
          "delete": false,
          "insert": false,
          "select": true,
          "update": false,
        }
      `);
   });

   test("selects aggregated rows from the native view", async () => {
      const account = await insertAccount("view");
      await insertOrder(account.accountId);
      await insertOrder(account.accountId);
      const result = await sql`
         select ${row(AccountOrderSummary.$$)} from ${AccountOrderSummary}
         where ${AccountOrderSummary.$accountId} = ${account.accountId}
      `.duckdb.one({ db });
      const { latestOrderAt, accountId, email, ...stable } = result;

      expect(latestOrderAt).toBeInstanceOf(Date);
      expect(accountId).toBe(account.accountId);
      expect(email).toBe(account.email);
      expect(stable).toMatchInlineSnapshot(`
        {
          "firstName": "view",
          "lastName": "DuckDB",
          "orderCount": 2n,
          "status": "created",
        }
      `);
   });
});
