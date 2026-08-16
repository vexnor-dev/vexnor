import { describe, expect, test } from "vitest";
import { insert, row } from "@vexnor/core";
import { DuckDBUnsupportedError, savepoint, sql, transaction } from "@vexnor/duckdb";
import { Account } from "./codegen/main.account-table.js";
import { db } from "./config.js";

describe("transaction() - DuckDB", { concurrent: false }, () => {
   test("commits native work on success", async () => {
      const email = `tx-commit-${crypto.randomUUID()}@example.com`;
      const inserted = await transaction(db, (tx) => sql`
         insert into ${Account} ${insert(Account, "rows")} returning ${row(Account.$$)}
      `.duckdb.one({ db: tx, params: { rows: [{ email, firstName: "Commit", lastName: "DuckDB" }] } }));
      const found = await sql`select ${row(Account.$$)} from ${Account} where ${Account.$accountId} = ${inserted.accountId}`.duckdb.one({ db });

      expect(found.accountId).toBe(inserted.accountId);
   });

   test("rolls native work back on failure", async () => {
      const email = `tx-rollback-${crypto.randomUUID()}@example.com`;
      await expect(transaction(db, async (tx) => {
         await sql`
            insert into ${Account} ${insert(Account, "rows")}
         `.duckdb.run({ db: tx, params: { rows: [{ email, firstName: "Rollback", lastName: "DuckDB" }] } });
         throw new Error("rollback requested");
      })).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: rollback requested]`);

      const rows = await sql`select ${row(Account.$accountId)} from ${Account} where ${Account.$email} = ${email}`.duckdb.all({ db });
      expect(rows).toMatchInlineSnapshot(`[]`);
   });

   test("reports unsupported savepoints with a typed error", () => {
      expect(() => savepoint()).toThrow(DuckDBUnsupportedError);
      expect(() => savepoint()).toThrowErrorMatchingInlineSnapshot(`[DuckDBUnsupportedError: DuckDB does not support savepoints]`);
   });
});
