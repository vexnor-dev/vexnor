import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { pool } from "./postgres-pool.js";
import { TestDataManager } from "./test-data-manager.js";
import { Account } from "./codegen/vexnor_dev.account-table.js";
import { row, sql } from "vexnor";

describe.sequential("vexnor postgres CRUD - insert", async (ctx) => {
   const dataManager = new TestDataManager(ctx, {
      ACCOUNT_ROOT_COUNT: 5,
      ACCOUNT_CHILD_FACTOR: 5,
   });

   beforeAll(async () => {
      await dataManager.initRootAccounts(pool);
      await dataManager.initChildAccounts(pool);
   });

   test("insert: root account", async () => {
      const rootAccount = dataManager.rootAccounts[0];
      ok(rootAccount, `no 'rootAccount' initialized.`);
      expect(rootAccount).toBeDefined();
   });

   test("insert: child account", async () => {
      const childAccount = dataManager.childAccounts[0];
      ok(childAccount, `no 'childAccount' initialized.`);
      expect(childAccount).toBeDefined();
   });

   test("insertRows: insert and return one row", async () => {
      const inserted = await Account.postgres.insertRows().one({
         db: pool,
         params: {
            rows: [{ email: "handler@test.com", firstName: "Handler", lastName: "Test" }],
         },
      });
      expect(inserted.email).toMatchInlineSnapshot(`"handler@test.com"`);
      expect(inserted.firstName).toMatchInlineSnapshot(`"Handler"`);

      // cleanup
      await sql`delete from ${Account} where ${Account.$accountId} = ${inserted.accountId}`.postgres.run({ db: pool });
   });

   test("insertFrom: insert account from SELECT", async () => {
      const source = await Account.postgres.insertRows().one({
         db: pool,
         params: { rows: [{ email: "insertfrom-source@test.com", firstName: "Source", lastName: "Account" }] },
      });
      const newId = crypto.randomUUID();

      const inserted = await Account.postgres
         .insertFrom({
            FROM: sql`
            select
               ${newId}::uuid,
               ${row(
                  Account.as("src").$status,
                  Account.as("src").$email,
                  Account.as("src").$firstName,
                  Account.as("src").$lastName,
                  Account.as("src").$notes,
                  Account.as("src").$createdAt,
                  Account.as("src").$modifiedAt,
                  Account.as("src").$parentId,
               )}
            from ${Account.as("src")}
            where ${Account.as("src").$accountId} = ${source.accountId}
         `,
         })
         .one({ db: pool });

      expect(inserted.email).toMatchInlineSnapshot(`"insertfrom-source@test.com"`);
      expect(inserted.firstName).toMatchInlineSnapshot(`"Source"`);

      // cleanup
      await sql`delete from ${Account} where ${Account.$accountId} in (${[source.accountId, inserted.accountId]})`.postgres.run(
         { db: pool },
      );
   });
});
