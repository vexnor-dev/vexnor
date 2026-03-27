import { afterAll, describe, expect, test } from "vitest";
import { row } from "valnor";
import { sql } from "valnor-sqlite3";
import { transaction, savepoint } from "valnor-sqlite3";
import { Account } from "./codegen/main.account-table.js";
import Database from "better-sqlite3";
import { SQLITE_PATH } from "./config.js";

describe.sequential("transaction() - sqlite3", () => {
   const db = new Database(SQLITE_PATH);

   afterAll(() => db.close());

   test("commits on success", async () => {
      const account = await transaction(db, async (tx) => {
         await sql`INSERT INTO ${Account} ${Account.insertColsVals({ email: "tx-commit@test.com", firstName: "Tx", lastName: "Commit" })}`.run({ db: tx });
         return sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$email} = ${"tx-commit@test.com"}`.one({ db: tx });
      });

      expect(account.email).toMatchInlineSnapshot(`"tx-commit@test.com"`);

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${account.accountId}`.run({ db });
   });

   test("rolls back on error", async () => {
      let insertedId: string | undefined;

      await expect(
         transaction(db, async (tx) => {
            await sql`INSERT INTO ${Account} ${Account.insertColsVals({ email: "tx-rollback@test.com", firstName: "Tx", lastName: "Rollback" })}`.run({ db: tx });
            const account = await sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$email} = ${"tx-rollback@test.com"}`.one({ db: tx });
            insertedId = account.accountId;
            throw new Error("forced rollback");
         }),
      ).rejects.toThrow("forced rollback");

      const found = await sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${insertedId}`.any({ db });
      expect(found).toMatchInlineSnapshot(`undefined`);
   });

   test("respects IMMEDIATE behavior", async () => {
      const account = await transaction(db, async (tx) => {
         await sql`INSERT INTO ${Account} ${Account.insertColsVals({ email: "tx-immediate@test.com", firstName: "Tx", lastName: "Immediate" })}`.run({ db: tx });
         return sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$email} = ${"tx-immediate@test.com"}`.one({ db: tx });
      }, { behavior: "IMMEDIATE" });

      expect(account.email).toMatchInlineSnapshot(`"tx-immediate@test.com"`);

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${account.accountId}`.run({ db });
   });

   test("respects EXCLUSIVE behavior", async () => {
      const account = await transaction(db, async (tx) => {
         await sql`INSERT INTO ${Account} ${Account.insertColsVals({ email: "tx-exclusive@test.com", firstName: "Tx", lastName: "Exclusive" })}`.run({ db: tx });
         return sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$email} = ${"tx-exclusive@test.com"}`.one({ db: tx });
      }, { behavior: "EXCLUSIVE" });

      expect(account.email).toMatchInlineSnapshot(`"tx-exclusive@test.com"`);

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${account.accountId}`.run({ db });
   });
});

describe.sequential("savepoint() - sqlite3", () => {
   const db = new Database(SQLITE_PATH);

   afterAll(() => db.close());

   test("releases savepoint on success, outer transaction commits", async () => {
      const result = await transaction(db, async (tx) => {
         await sql`INSERT INTO ${Account} ${Account.insertColsVals({ email: "sp-outer@test.com", firstName: "Sp", lastName: "Outer" })}`.run({ db: tx });
         const outer = await sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$email} = ${"sp-outer@test.com"}`.one({ db: tx });

         const inner = await savepoint(tx, async (tx2) => {
            await sql`INSERT INTO ${Account} ${Account.insertColsVals({ email: "sp-inner@test.com", firstName: "Sp", lastName: "Inner" })}`.run({ db: tx2 });
            return sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$email} = ${"sp-inner@test.com"}`.one({ db: tx2 });
         });

         return { outer, inner };
      });

      expect(result.outer.email).toMatchInlineSnapshot(`"sp-outer@test.com"`);
      expect(result.inner?.email).toMatchInlineSnapshot(`"sp-inner@test.com"`);

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} IN (${[result.outer.accountId, result.inner?.accountId]})`.run({ db });
   });

   test("rolls back savepoint on error, outer transaction continues", async () => {
      const result = await transaction(db, async (tx) => {
         await sql`INSERT INTO ${Account} ${Account.insertColsVals({ email: "sp-outer-err@test.com", firstName: "Sp", lastName: "OuterErr" })}`.run({ db: tx });
         const outer = await sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$email} = ${"sp-outer-err@test.com"}`.one({ db: tx });

         const inner = await savepoint(tx, async (tx2) => {
            await sql`INSERT INTO ${Account} ${Account.insertColsVals({ email: "sp-inner-err@test.com", firstName: "Sp", lastName: "InnerErr" })}`.run({ db: tx2 });
            throw new Error("savepoint rollback");
         });

         return { outer, inner };
      });

      expect(result.outer.email).toMatchInlineSnapshot(`"sp-outer-err@test.com"`);
      expect(result.inner).toMatchInlineSnapshot(`undefined`);

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${result.outer.accountId}`.run({ db });
   });

   test("savepoint with explicit name", async () => {
      const result = await transaction(db, async (tx) => {
         await sql`INSERT INTO ${Account} ${Account.insertColsVals({ email: "sp-named@test.com", firstName: "Sp", lastName: "Named" })}`.run({ db: tx });
         const outer = await sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$email} = ${"sp-named@test.com"}`.one({ db: tx });

         await savepoint(tx, "my_savepoint", async (tx2) => {
            await sql`INSERT INTO ${Account} ${Account.insertColsVals({ email: "sp-named-inner@test.com", firstName: "Sp", lastName: "NamedInner" })}`.run({ db: tx2 });
            throw new Error("rollback named savepoint");
         });

         return outer;
      });

      expect(result.email).toMatchInlineSnapshot(`"sp-named@test.com"`);

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${result.accountId}`.run({ db });
   });
});
