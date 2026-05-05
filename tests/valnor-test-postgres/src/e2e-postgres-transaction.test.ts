import { describe, expect, test } from "vitest";
import { row, SqlRunError } from "valnor";
import { sql } from "valnor-postgres";
import { transaction, savepoint } from "valnor-postgres";
import { Account } from "./codegen/valnor_test.account-table.js";
import { pool } from "./postgres-pool.js";

describe.sequential("transaction() - postgres", () => {
   test("commits on success", async () => {
      const account = await transaction(pool, async (tx) => {
         return sql`
            INSERT INTO ${Account} ${Account.insertColsVals({ email: "tx-commit@test.com", firstName: "Tx", lastName: "Commit" })}
            RETURNING ${row(Account.$$)}
         `.one({ db: tx });
      });

      expect(account.email).toMatchInlineSnapshot(`"tx-commit@test.com"`);

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${account.accountId}`.postgres.run({ db: pool });
   });

   test("rolls back on error", async () => {
      let insertedId: string | undefined;

      await expect(
         transaction(pool, async (tx) => {
            const account = await sql`
               INSERT INTO ${Account} ${Account.insertColsVals({ email: "tx-rollback@test.com", firstName: "Tx", lastName: "Rollback" })}
               RETURNING ${row(Account.$$)}
            `.one({ db: tx });
            insertedId = account.accountId;
            throw new Error("forced rollback");
         }),
      ).rejects.toThrow("forced rollback");

      const found = await sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${insertedId}`.any({ db: pool });
      expect(found).toMatchInlineSnapshot(`undefined`);
   });

   test("respects isolation level option", async () => {
      const account = await transaction(pool, async (tx) => {
         return sql`
            INSERT INTO ${Account} ${Account.insertColsVals({ email: "tx-serializable@test.com", firstName: "Tx", lastName: "Serializable" })}
            RETURNING ${row(Account.$$)}
         `.one({ db: tx });
      }, { isolationLevel: "SERIALIZABLE" });

      expect(account.email).toMatchInlineSnapshot(`"tx-serializable@test.com"`);

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${account.accountId}`.postgres.run({ db: pool });
   });

   test("respects READ ONLY access mode", async () => {
      const error = await transaction(pool, async (tx) => {
         await sql`
            INSERT INTO ${Account} ${Account.insertColsVals({ email: "tx-readonly@test.com", firstName: "Tx", lastName: "ReadOnly" })}
         `.postgres.run({ db: tx });
      }, { accessMode: "READ ONLY" }).catch((err) => err);

      expect(error).toBeInstanceOf(SqlRunError);
      expect(error.cause).toMatchInlineSnapshot(`
        [error: cannot execute INSERT in a read-only transaction]
      `);
      expect(error.sql).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "valnor_test"."account" ("email", "first_name", "last_name")
        VALUES
          ($1, $2, $3)
          /* </query_0> */"
      `);
   });
});

describe.sequential("savepoint() - postgres", () => {
   test("releases savepoint on success, outer transaction commits", async () => {
      const result = await transaction(pool, async (tx) => {
         const outer = await sql`
            INSERT INTO ${Account} ${Account.insertColsVals({ email: "sp-outer@test.com", firstName: "Sp", lastName: "Outer" })}
            RETURNING ${row(Account.$$)}
         `.one({ db: tx });

         const inner = await savepoint(tx, async (tx2) => {
            return sql`
               INSERT INTO ${Account} ${Account.insertColsVals({ email: "sp-inner@test.com", firstName: "Sp", lastName: "Inner" })}
               RETURNING ${row(Account.$$)}
            `.one({ db: tx2 });
         });

         return { outer, inner };
      });

      expect(result.outer.email).toMatchInlineSnapshot(`"sp-outer@test.com"`);
      expect(result.inner?.email).toMatchInlineSnapshot(`"sp-inner@test.com"`);

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} IN (${[result.outer.accountId, result.inner?.accountId]})`.postgres.run({ db: pool });
   });

   test("rolls back savepoint on error, outer transaction continues", async () => {
      const result = await transaction(pool, async (tx) => {
         const outer = await sql`
            INSERT INTO ${Account} ${Account.insertColsVals({ email: "sp-outer-err@test.com", firstName: "Sp", lastName: "OuterErr" })}
            RETURNING ${row(Account.$$)}
         `.one({ db: tx });

         const inner = await savepoint(tx, async (tx2) => {
            await sql`
               INSERT INTO ${Account} ${Account.insertColsVals({ email: "sp-inner-err@test.com", firstName: "Sp", lastName: "InnerErr" })}
               RETURNING ${row(Account.$$)}
            `.one({ db: tx2 });
            throw new Error("savepoint rollback");
         });

         return { outer, inner };
      });

      expect(result.outer.email).toMatchInlineSnapshot(`"sp-outer-err@test.com"`);
      expect(result.inner).toMatchInlineSnapshot(`undefined`);

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${result.outer.accountId}`.postgres.run({ db: pool });
   });

   test("savepoint with explicit name", async () => {
      const result = await transaction(pool, async (tx) => {
         const outer = await sql`
            INSERT INTO ${Account} ${Account.insertColsVals({ email: "sp-named@test.com", firstName: "Sp", lastName: "Named" })}
            RETURNING ${row(Account.$$)}
         `.one({ db: tx });

         await savepoint(tx, "my_savepoint", async (tx2) => {
            await sql`
               INSERT INTO ${Account} ${Account.insertColsVals({ email: "sp-named-inner@test.com", firstName: "Sp", lastName: "NamedInner" })}
            `.postgres.run({ db: tx2 });
            throw new Error("rollback named savepoint");
         });

         return outer;
      });

      expect(result.email).toMatchInlineSnapshot(`"sp-named@test.com"`);

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${result.accountId}`.postgres.run({ db: pool });
   });
});
