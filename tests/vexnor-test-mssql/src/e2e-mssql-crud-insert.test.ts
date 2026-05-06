import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { pool } from "./mssql-pool.js";
import { TestDataManager } from "./test-data-manager.js";

describe.sequential("vexnor mssql CRUD - insert", async (ctx) => {
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
});
