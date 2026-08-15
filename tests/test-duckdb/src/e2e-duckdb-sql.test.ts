import { describe, expect, test } from "vitest";
import { param, row } from "@vexnor/core";
import { sql } from "@vexnor/duckdb";
import { Account } from "./codegen/main.account-table.js";
import { db } from "./config.js";
import { insertAccount } from "./fixtures.js";

describe("vexnor DuckDB SQL e2e", { concurrent: false }, () => {
   test("executes parameterized selects against native DuckDB", async () => {
      const inserted = await insertAccount("sql-parameter");
      const result = await sql`
         select ${row(Account.$$)} from ${Account}
         where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
      `.duckdb.one({ db, params: { accountId: inserted.accountId } });
      const { accountId, createdAt, modifiedAt, email, ...stable } = result;

      expect(accountId).toBe(inserted.accountId);
      expect(email).toBe(inserted.email);
      expect(createdAt).toBeInstanceOf(Date);
      expect(modifiedAt).toBeInstanceOf(Date);
      expect(stable).toMatchInlineSnapshot(`
        {
          "firstName": "sql-parameter",
          "lastName": "DuckDB",
          "notes": null,
          "parentId": null,
          "status": "created",
        }
      `);
   });

   test("supports all, one, and any result modes", async () => {
      const inserted = await insertAccount("sql-modes");
      const query = sql`
         select ${row(Account.$accountId, Account.$email)} from ${Account}
         where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
      `;

      const all = await query.duckdb.all({ db, params: { accountId: inserted.accountId } });
      const one = await query.duckdb.one({ db, params: { accountId: inserted.accountId } });
      const missing = await query.duckdb.any({ db, params: { accountId: crypto.randomUUID() } });

      expect(all).toHaveLength(1);
      expect(all[0]!.accountId).toBe(inserted.accountId);
      expect(all[0]!.email).toBe(inserted.email);
      expect(one.accountId).toBe(inserted.accountId);
      expect(one.email).toBe(inserted.email);
      expect(missing).toBeUndefined();
      expect({ allCount: all.length, sameRow: all[0]!.accountId === one.accountId, missing }).toMatchInlineSnapshot(`
        {
          "allCount": 1,
          "missing": undefined,
          "sameRow": true,
        }
      `);
   });

   test("reports native write metadata", async () => {
      const inserted = await insertAccount("sql-write");
      const result = await sql`
         update ${Account} set ${Account.$notes} = ${"updated"}
         where ${Account.$accountId} = ${inserted.accountId}
      `.duckdb.run({ db });

      expect({ rowCount: result.rowCount, rowsChanged: result.rowsChanged, rows: result.rows }).toMatchInlineSnapshot(`
        {
          "rowCount": 1,
          "rows": [
            {
              "Count": 1n,
            },
          ],
          "rowsChanged": 1,
        }
      `);
   });
});
