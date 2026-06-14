import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import "@vexnor/postgres";
import { Account, IAccountSelect } from "./codegen/vexnor_dev.schema.js";
import { pool } from "./postgres-pool.js";
import { TestDataManager } from "./test-data-manager.js";

describe.sequential("vexnor postgres table handler - find", async (ctx) => {
   let rootAccount!: IAccountSelect;

   const dataManager = new TestDataManager(ctx, {
      ACCOUNT_ROOT_COUNT: 1,
   });

   beforeAll(async () => {
      await dataManager.initRootAccounts(pool);
      rootAccount = dataManager.rootAccounts[0]!;
      ok(rootAccount, `no 'rootAccount' initialized.`);
   });

   test("findById: fetch account by PK", async () => {
      const result = await Account.postgres.findById().any({ db: pool, params: { accountId: rootAccount.accountId } });
      expect(result?.accountId).toBe(rootAccount.accountId);
      expect(result?.email).toBe(rootAccount.email);
   });

   test("findBy: fetch account by email", async () => {
      const result = await Account.postgres.findBy().any({ db: pool, params: { email: rootAccount.email } });
      expect(result?.accountId).toBe(rootAccount.accountId);
   });

   test("findBy: fetch account by multiple fields", async () => {
      const result = await Account.postgres
         .findBy()
         .any({ db: pool, params: { email: rootAccount.email, lastName: rootAccount.lastName } });
      expect(result?.accountId).toBe(rootAccount.accountId);
   });
});
