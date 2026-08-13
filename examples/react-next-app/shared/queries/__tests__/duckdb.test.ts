import { describe, expect, test } from "vitest";
import { getDuckDb } from "../../db/duckdb";
import { deleteAccount, insertAccount, selectAccounts } from "../duckdb";

describe.sequential("Next.js DuckDB example queries", () => {
   test("executes generated CRUD and typed account selection against the example database", async () => {
      const duckDb = await getDuckDb();
      const email = `next-duckdb-${crypto.randomUUID()}@example.com`;
      const inserted = await insertAccount.one({
         db: duckDb,
         params: { rows: [{ email, firstName: "Next", lastName: "DuckDB" }] },
      });

      const accounts = await selectAccounts.duckdb.all({
         db: duckDb,
         params: { filter: email },
      });
      const selected = accounts[0]!;

      expect(typeof inserted.accountId).toMatchInlineSnapshot(`"string"`);
      expect(inserted.createdAt).toBeInstanceOf(Date);
      expect({
         emailMatches: selected.email === email,
         firstName: selected.firstName,
         lastName: selected.lastName,
         orderCount: selected.orderCount,
         lastOrder: selected.lastOrder,
      }).toMatchInlineSnapshot(`
        {
          "emailMatches": true,
          "firstName": "Next",
          "lastName": "DuckDB",
          "lastOrder": null,
          "orderCount": 0,
        }
      `);

      const deleted = await deleteAccount.one({ db: duckDb, params: { accountId: inserted.accountId } });
      expect(deleted.accountId === inserted.accountId).toMatchInlineSnapshot(`true`);
   });
});
