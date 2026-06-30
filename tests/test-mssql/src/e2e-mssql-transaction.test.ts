import { describe, expect, test } from "vitest";
import { insert, row } from "@vexnor/core";
import { sql } from "@vexnor/mssql";
import { transaction, savepoint } from "@vexnor/mssql";
import { Account } from "./codegen/vexnor_dev.account-table.js";
import { pool } from "./mssql-pool.js";


describe.sequential("transaction() - mssql", () => {
   test("commits on success", async () => {
      const account = await transaction(pool, async (tx) => {
         return sql`
            INSERT INTO ${Account}
               (${insert.cols(Account, "rows")})
               OUTPUT ${row(Account.as("inserted").$$)}
               VALUES ${insert.values(Account, "rows")}
         `.one({ db: tx.request(), params: { rows: [{ email: "tx-commit@test.com", firstName: "Tx", lastName: "Commit" }] } });
      });

      expect(account.email).toMatchInlineSnapshot(`"tx-commit@test.com"`);

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${account.accountId}`.mssql.run({ db: pool.request() });
   });

   test("rolls back on error", async () => {
      let insertedId: string | undefined;

      await expect(
         transaction(pool, async (tx) => {
            const account = await sql`
               INSERT INTO ${Account}
                  (${insert.cols(Account, "rows")})
                  OUTPUT ${row(Account.as("inserted").$$)}
                  VALUES ${insert.values(Account, "rows")}
            `.one({ db: tx.request(), params: { rows: [{ email: "tx-rollback@test.com", firstName: "Tx", lastName: "Rollback" }] } });
            insertedId = account.accountId;
            throw new Error("forced rollback");
         }),
      ).rejects.toThrow("forced rollback");

      const found = await sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${insertedId}`.any({ db: pool.request() });
      expect(found).toMatchInlineSnapshot(`undefined`);
   });

   test("respects isolation level option", async () => {
      const account = await transaction(pool, async (tx) => {
         return sql`
            INSERT INTO ${Account}
               (${insert.cols(Account, "rows")})
               OUTPUT ${row(Account.as("inserted").$$)}
               VALUES ${insert.values(Account, "rows")}
         `.one({ db: tx.request(), params: { rows: [{ email: "tx-serializable@test.com", firstName: "Tx", lastName: "Serializable" }] } });
      }, { isolationLevel: "SERIALIZABLE" });

      expect(account.email).toMatchInlineSnapshot(`"tx-serializable@test.com"`);

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${account.accountId}`.mssql.run({ db: pool.request() });
   });
});

describe.sequential("savepoint() - mssql", () => {
   test("outer transaction commits, savepoint released", async () => {
      const result = await transaction(pool, async (tx) => {
         const outer = await sql`
            INSERT INTO ${Account}
               (${insert.cols(Account, "rows")})
               OUTPUT ${row(Account.as("inserted").$$)}
               VALUES ${insert.values(Account, "rows")}
         `.one({ db: tx.request(), params: { rows: [{ email: "sp-outer@test.com", firstName: "Sp", lastName: "Outer" }] } });

         const inner = await savepoint(tx, async (req2) => {
            return sql`
               INSERT INTO ${Account}
                  (${insert.cols(Account, "rows")})
                  OUTPUT ${row(Account.as("inserted").$$)}
                  VALUES ${insert.values(Account, "rows")}
            `.one({ db: req2, params: { rows: [{ email: "sp-inner@test.com", firstName: "Sp", lastName: "Inner" }] } });
         });

         return { outer, inner };
      });

      expect(result.outer.email).toMatchInlineSnapshot(`"sp-outer@test.com"`);
      expect(result.inner?.email).toMatchInlineSnapshot(`"sp-inner@test.com"`);

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} IN (${[result.outer.accountId, result.inner?.accountId]})`.mssql.run({ db: pool.request() });
   });

   test("rolls back savepoint on error, outer transaction continues", async () => {
      const result = await transaction(pool, async (tx) => {
         const outer = await sql`
            INSERT INTO ${Account}
               (${insert.cols(Account, "rows")})
               OUTPUT ${row(Account.as("inserted").$$)}
               VALUES ${insert.values(Account, "rows")}
         `.one({ db: tx.request(), params: { rows: [{ email: "sp-outer-err@test.com", firstName: "Sp", lastName: "OuterErr" }] } });

         const inner = await savepoint(tx, async (req2) => {
            await sql`
               INSERT INTO ${Account}
                  (${insert.cols(Account, "rows")})
                  OUTPUT ${row(Account.as("inserted").$$)}
                  VALUES ${insert.values(Account, "rows")}
            `.one({ db: req2, params: { rows: [{ email: "sp-inner-err@test.com", firstName: "Sp", lastName: "InnerErr" }] } });
            throw new Error("savepoint rollback");
         });

         return { outer, inner };
      });

      expect(result.outer.email).toMatchInlineSnapshot(`"sp-outer-err@test.com"`);
      expect(result.inner).toMatchInlineSnapshot(`undefined`);

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${result.outer.accountId}`.mssql.run({ db: pool.request() });
   });

   test("savepoint with explicit name", async () => {
      const result = await transaction(pool, async (tx) => {
         const outer = await sql`
            INSERT INTO ${Account}
               (${insert.cols(Account, "rows")})
               OUTPUT ${row(Account.as("inserted").$$)}
               VALUES ${insert.values(Account, "rows")}
         `.one({ db: tx.request(), params: { rows: [{ email: "sp-named@test.com", firstName: "Sp", lastName: "Named" }] } });

         await savepoint(tx, "my_savepoint", async (req2) => {
            await sql`
               INSERT INTO ${Account}
                  (${insert.cols(Account, "rows")})
                  OUTPUT ${row(Account.as("inserted").$$)}
                  VALUES ${insert.values(Account, "rows")}
            `.mssql.run({ db: req2, params: { rows: [{ email: "sp-named-inner@test.com", firstName: "Sp", lastName: "NamedInner" }] } });
            throw new Error("rollback named savepoint");
         });

         return outer;
      });

      expect(result.email).toMatchInlineSnapshot(`"sp-named@test.com"`);

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${result.accountId}`.mssql.run({ db: pool.request() });
   });
});
