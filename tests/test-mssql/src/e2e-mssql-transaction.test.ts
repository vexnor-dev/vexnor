import { describe, expect, test } from "vitest";
import { row } from "vexnor";
import { sql } from "@vexnor/mssql";
import { transaction, savepoint } from "@vexnor/mssql";
import { Account } from "./codegen/vexnor_dev.account-table.js";
import { pool } from "./mssql-pool.js";

describe.sequential("transaction() - mssql", () => {
   test("commits on success", async () => {
      const account = await transaction(pool, async (tx) => {
         return sql`
            INSERT INTO ${Account}
               ${Account.insertCols({ email: "tx-commit@test.com", firstName: "Tx", lastName: "Commit" })}
               OUTPUT ${row(Account.as("inserted").$$)}
               ${Account.insertVals({ email: "tx-commit@test.com", firstName: "Tx", lastName: "Commit" })}
         `.one({ db: tx.request() });
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
                  ${Account.insertCols({ email: "tx-rollback@test.com", firstName: "Tx", lastName: "Rollback" })}
                  OUTPUT ${row(Account.as("inserted").$$)}
                  ${Account.insertVals({ email: "tx-rollback@test.com", firstName: "Tx", lastName: "Rollback" })}
            `.one({ db: tx.request() });
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
               ${Account.insertCols({ email: "tx-serializable@test.com", firstName: "Tx", lastName: "Serializable" })}
               OUTPUT ${row(Account.as("inserted").$$)}
               ${Account.insertVals({ email: "tx-serializable@test.com", firstName: "Tx", lastName: "Serializable" })}
         `.one({ db: tx.request() });
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
               ${Account.insertCols({ email: "sp-outer@test.com", firstName: "Sp", lastName: "Outer" })}
               OUTPUT ${row(Account.as("inserted").$$)}
               ${Account.insertVals({ email: "sp-outer@test.com", firstName: "Sp", lastName: "Outer" })}
         `.one({ db: tx.request() });

         const inner = await savepoint(tx, async (req2) => {
            return sql`
               INSERT INTO ${Account}
                  ${Account.insertCols({ email: "sp-inner@test.com", firstName: "Sp", lastName: "Inner" })}
                  OUTPUT ${row(Account.as("inserted").$$)}
                  ${Account.insertVals({ email: "sp-inner@test.com", firstName: "Sp", lastName: "Inner" })}
            `.one({ db: req2 });
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
               ${Account.insertCols({ email: "sp-outer-err@test.com", firstName: "Sp", lastName: "OuterErr" })}
               OUTPUT ${row(Account.as("inserted").$$)}
               ${Account.insertVals({ email: "sp-outer-err@test.com", firstName: "Sp", lastName: "OuterErr" })}
         `.one({ db: tx.request() });

         const inner = await savepoint(tx, async (req2) => {
            await sql`
               INSERT INTO ${Account}
                  ${Account.insertCols({ email: "sp-inner-err@test.com", firstName: "Sp", lastName: "InnerErr" })}
                  OUTPUT ${row(Account.as("inserted").$$)}
                  ${Account.insertVals({ email: "sp-inner-err@test.com", firstName: "Sp", lastName: "InnerErr" })}
            `.one({ db: req2 });
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
               ${Account.insertCols({ email: "sp-named@test.com", firstName: "Sp", lastName: "Named" })}
               OUTPUT ${row(Account.as("inserted").$$)}
               ${Account.insertVals({ email: "sp-named@test.com", firstName: "Sp", lastName: "Named" })}
         `.one({ db: tx.request() });

         await savepoint(tx, "my_savepoint", async (req2) => {
            await sql`
               INSERT INTO ${Account}
                  ${Account.insertCols({ email: "sp-named-inner@test.com", firstName: "Sp", lastName: "NamedInner" })}
                  OUTPUT ${row(Account.as("inserted").$$)}
                  ${Account.insertVals({ email: "sp-named-inner@test.com", firstName: "Sp", lastName: "NamedInner" })}
            `.mssql.run({ db: req2 });
            throw new Error("rollback named savepoint");
         });

         return outer;
      });

      expect(result.email).toMatchInlineSnapshot(`"sp-named@test.com"`);

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${result.accountId}`.mssql.run({ db: pool.request() });
   });
});
